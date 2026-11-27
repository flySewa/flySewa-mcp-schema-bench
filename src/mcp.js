import { McpServer } from '@modelcontextprotocol/server';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { TOOLS, TOOL_NAMES } from './schemas/meta.js';
import { valibotStandard, valibotUnwrappedStandard, zodOptimizedStandard } from './convert.js';

const SERVER_INFO = { name: 'schema-bench', version: '1.0.0' };

/**
 * One McpServer per variant. All three use the SDK's high-level
 * registerTool(), which converts the Standard Schema to JSON Schema itself
 * and validates tools/call arguments with the schema's ~standard.validate.
 */
function makeServer(inputSchemas) {
  const server = new McpServer(SERVER_INFO);
  for (const name of TOOL_NAMES) {
    server.registerTool(
      name,
      {
        title: TOOLS[name].title,
        description: TOOLS[name].description,
        inputSchema: inputSchemas[name],
      },
      async (args) => ({ content: [{ type: 'text', text: JSON.stringify(args) }] }),
    );
  }
  return server;
}

const mapTools = (fn) => Object.fromEntries(TOOL_NAMES.map((n) => [n, fn(n)]));

export function buildServers({ zodSchemas, valibotSchemas }) {
  return {
    zod: () => makeServer(zodSchemas),
    zod_optimized: () => makeServer(mapTools((n) => zodOptimizedStandard(zodSchemas[n]))),
    valibot: () => makeServer(mapTools((n) => valibotStandard(valibotSchemas[n]))),
    // Not measured: plain toStandardJsonSchema() without the workaround.
    valibot_unwrapped: () =>
      makeServer(mapTools((n) => valibotUnwrappedStandard(valibotSchemas[n]))),
  };
}

async function connect(createServer) {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const sent = [];
  const originalSend = serverTransport.send.bind(serverTransport);
  serverTransport.send = async (message, options) => {
    // Round-trip through JSON so we store exactly what a stdio or HTTP
    // transport would put on the wire (undefined fields disappear).
    sent.push(JSON.parse(JSON.stringify(message)));
    return originalSend(message, options);
  };
  const client = new Client({ name: 'bench-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const close = async () => {
    await client.close();
    await server.close();
  };
  return { client, sent, close };
}

/** Calls a tool and reports whether the server accepted the arguments. */
async function accepted(client, name, args) {
  try {
    const result = await client.callTool({ name, arguments: args });
    return result.isError !== true;
  } catch {
    return false;
  }
}

/**
 * Connects an in-memory client, calls tools/list, and returns the exact
 * JSON-RPC response the server serialised onto the transport, plus the
 * negotiated protocol version. Also calls every tool once with a valid and
 * once with an invalid input to confirm the server validates.
 */
export async function captureToolsList(createServer, probes) {
  const { client, sent, close } = await connect(createServer);
  const parsed = await client.listTools();
  const raw = sent.find((m) => m.result && Array.isArray(m.result.tools));
  if (!raw) throw new Error('tools/list response not captured');
  if (parsed.tools.length !== TOOL_NAMES.length) throw new Error('unexpected tool count');
  const init = sent.find((m) => m.result && m.result.protocolVersion);

  const calls = {};
  for (const name of TOOL_NAMES) {
    calls[name] = {
      validAccepted: await accepted(client, name, probes[name].valid),
      invalidRejected: !(await accepted(client, name, probes[name].invalid)),
    };
  }
  await close();
  return { raw, calls, protocolVersion: init?.result.protocolVersion ?? null };
}

/** Runs tools/list and returns the error message, or null if it succeeded. */
export async function toolsListError(createServer) {
  const { client, close } = await connect(createServer);
  try {
    await client.listTools();
    return null;
  } catch (error) {
    return String(error?.message ?? error);
  } finally {
    await close().catch(() => {});
  }
}
