import * as v from 'valibot';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, TOOL_NAMES } from './schemas/meta.js';
import { valibotToJson, zodToJson } from './convert.js';

const SERVER_INFO = { name: 'schema-bench', version: '1.0.0' };
const ok = (args) => ({ content: [{ type: 'text', text: JSON.stringify(args) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });

/**
 * Default Zod: the SDK's high-level McpServer.registerTool(), which converts
 * Zod to JSON Schema itself and validates tools/call arguments with Zod.
 */
function zodDefaultServer(schemas) {
  const server = new McpServer(SERVER_INFO);
  for (const name of TOOL_NAMES) {
    server.registerTool(
      name,
      { title: TOOLS[name].title, description: TOOLS[name].description, inputSchema: schemas[name] },
      async (args) => ok(args),
    );
  }
  return server.server;
}

/**
 * Low-level Server with hand-supplied JSON Schema. McpServer 1.32.2 only
 * accepts Zod and gives no hook to change its JSON Schema output, so both
 * "Zod optimized" and Valibot use the documented low-level Server API.
 */
function lowLevelServer(jsonSchemas, validate) {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_NAMES.map((name) => ({
      name,
      title: TOOLS[name].title,
      description: TOOLS[name].description,
      inputSchema: jsonSchemas[name],
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!TOOL_NAMES.includes(name)) return fail(`Unknown tool ${name}`);
    const result = validate(name, args ?? {});
    return result.success ? ok(result.data) : fail(result.message);
  });
  return server;
}

export function buildServers({ zodSchemas, valibotSchemas }) {
  const zodOptimizedJson = Object.fromEntries(
    TOOL_NAMES.map((n) => [n, zodToJson(zodSchemas[n], { optimized: true })]),
  );
  const valibotJson = Object.fromEntries(
    TOOL_NAMES.map((n) => [n, valibotToJson(valibotSchemas[n])]),
  );
  return {
    zod: () => zodDefaultServer(zodSchemas),
    zod_optimized: () =>
      lowLevelServer(zodOptimizedJson, (name, args) => {
        const r = zodSchemas[name].safeParse(args);
        return r.success ? { success: true, data: r.data } : { success: false, message: r.error.message };
      }),
    valibot: () =>
      lowLevelServer(valibotJson, (name, args) => {
        const r = v.safeParse(valibotSchemas[name], args);
        return r.success
          ? { success: true, data: r.output }
          : { success: false, message: JSON.stringify(v.flatten(r.issues)) };
      }),
  };
}

/**
 * Connects an in-memory client, calls tools/list, and returns the exact
 * JSON-RPC response the server serialised onto the transport. Also calls
 * every tool once with a valid and once with an invalid input to confirm
 * the server validates.
 */
export async function captureToolsList(createServer, probes) {
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

  const parsed = await client.listTools();
  const raw = sent.find((m) => m.result && Array.isArray(m.result.tools));
  if (!raw) throw new Error('tools/list response not captured');
  if (parsed.tools.length !== TOOL_NAMES.length) throw new Error('unexpected tool count');

  const calls = {};
  for (const name of TOOL_NAMES) {
    const good = await client.callTool({ name, arguments: probes[name].valid });
    const bad = await client.callTool({ name, arguments: probes[name].invalid });
    calls[name] = { validAccepted: !good.isError, invalidRejected: bad.isError === true };
  }

  await client.close();
  await server.close();
  return { raw, calls };
}
