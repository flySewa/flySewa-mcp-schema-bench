import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import { buildZodSchemas } from './schemas/zod.js';
import { buildValibotSchemas } from './schemas/valibot.js';
import { TOOLS, TOOL_NAMES } from './schemas/meta.js';
import { CASES } from './cases.js';
import { checkEquivalence } from './equivalence.js';
import {
  valibotLibraryDefault,
  valibotToJson,
  zodLibraryDefault,
  zodToJson,
} from './convert.js';
import { buildServers, captureToolsList } from './mcp.js';
import { countO200k, createAnthropicCounter, O200K_LABEL } from './tokens.js';
import { diffSchemas, summarizeDiff } from './diff.js';
import { writeReport } from './report.js';
import { runDivergenceProbes } from './divergences.js';

const Ajv = AjvModule.default ?? AjvModule;
const addFormats = addFormatsModule.default ?? addFormatsModule;
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RESULTS = path.join(ROOT, 'results');
const VARIANTS = ['zod', 'zod_optimized', 'valibot'];
const SCENARIOS = [
  { id: 'bare', describe: false, label: 'No field descriptions' },
  { id: 'described', describe: true, label: 'With field descriptions' },
];

const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
const minify = (x) => JSON.stringify(x);
const bytes = (s) => Buffer.byteLength(s, 'utf8');

function environment() {
  const pkg = (name) => require(`${name}/package.json`).version;
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const locked = (name) => lock.packages[`node_modules/${name}`]?.version;
  const names = [
    'zod',
    'valibot',
    '@valibot/to-json-schema',
    '@modelcontextprotocol/sdk',
    'js-tiktoken',
    '@anthropic-ai/sdk',
    'ajv',
    'ajv-formats',
  ];
  return {
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.platform()}/${os.arch()})`,
    packages: Object.fromEntries(names.map((n) => [n, locked(n) ?? pkg(n)])),
  };
}

async function main() {
  fs.rmSync(RESULTS, { recursive: true, force: true });
  fs.mkdirSync(RESULTS, { recursive: true });
  const env = environment();
  writeJson(path.join(RESULTS, 'environment.json'), env);
  const anthropic = createAnthropicCounter();
  console.log(
    anthropic
      ? `Tokenizers: ${O200K_LABEL}; ${anthropic.label}`
      : `Tokenizers: ${O200K_LABEL}. ANTHROPIC_API_KEY not set, skipping Anthropic counts.`,
  );

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const data = { env, anthropicLabel: anthropic?.label ?? null, scenarios: [] };

  for (const scenario of SCENARIOS) {
    const dir = path.join(RESULTS, scenario.id);
    const zodSchemas = buildZodSchemas({ describe: scenario.describe });
    const valibotSchemas = buildValibotSchemas({ describe: scenario.describe });

    // 1. Equivalence: stop on any disagreement.
    const equivalence = checkEquivalence(zodSchemas, valibotSchemas);
    writeJson(path.join(dir, 'equivalence.json'), equivalence);
    if (!equivalence.ok) {
      console.error(`Equivalence check FAILED (${scenario.id}). See ${dir}/equivalence.json`);
      for (const [tool, e] of Object.entries(equivalence.tools)) {
        for (const d of e.disagreements) console.error(tool, JSON.stringify(d));
      }
      process.exit(1);
    }

    const divergences = runDivergenceProbes(zodSchemas, valibotSchemas);
    writeJson(path.join(dir, 'divergences.json'), divergences);

    // 2. Standalone JSON Schema per variant.
    const standalone = { zod: {}, zod_optimized: {}, valibot: {} };
    const libraryDefaults = { zod: { chars: 0, o200k: 0 }, valibot: { chars: 0, o200k: 0 } };
    for (const tool of TOOL_NAMES) {
      for (const [lib, json] of [
        ['zod', zodLibraryDefault(zodSchemas[tool])],
        ['valibot', valibotLibraryDefault(valibotSchemas[tool])],
      ]) {
        libraryDefaults[lib].chars += minify(json).length;
        libraryDefaults[lib].o200k += countO200k(minify(json));
      }
      standalone.zod[tool] = zodToJson(zodSchemas[tool]);
      standalone.zod_optimized[tool] = zodToJson(zodSchemas[tool], { optimized: true });
      standalone.valibot[tool] = valibotToJson(valibotSchemas[tool]);
      writeJson(path.join(dir, 'json-schema/library-defaults/zod', `${tool}.json`), zodLibraryDefault(zodSchemas[tool]));
      writeJson(path.join(dir, 'json-schema/library-defaults/valibot', `${tool}.json`), valibotLibraryDefault(valibotSchemas[tool]));
    }
    for (const variant of VARIANTS) {
      for (const tool of TOOL_NAMES) {
        writeJson(path.join(dir, 'json-schema', variant, `${tool}.json`), standalone[variant][tool]);
      }
    }

    // 3. Real MCP servers, tools/list over an in-memory transport.
    const probes = Object.fromEntries(
      TOOL_NAMES.map((t) => [t, { valid: CASES[t].valid[0], invalid: CASES[t].invalid[1] }]),
    );
    const servers = buildServers({ zodSchemas, valibotSchemas });
    const wire = {};
    for (const variant of VARIANTS) {
      const { raw, calls } = await captureToolsList(servers[variant], probes);
      writeJson(path.join(dir, 'tools-list', `${variant}.json`), raw);
      const inputSchemas = Object.fromEntries(raw.result.tools.map((t) => [t.name, t.inputSchema]));
      wire[variant] = {
        raw,
        calls,
        inputSchemas,
        matchesStandalone: TOOL_NAMES.every((t) => isDeepStrictEqual(inputSchemas[t], standalone[variant][t])),
      };
      for (const [tool, c] of Object.entries(calls)) {
        if (!c.validAccepted || !c.invalidRejected) {
          throw new Error(`${variant} server did not validate ${tool} correctly: ${JSON.stringify(c)}`);
        }
      }
    }

    // 4. Measurements on minified JSON of the inputSchema each client received.
    const measurements = {};
    for (const variant of VARIANTS) {
      measurements[variant] = { tools: {}, total: {}, response: {} };
      for (const tool of TOOL_NAMES) {
        const schema = wire[variant].inputSchemas[tool];
        const text = minify(schema);
        const m = { chars: text.length, bytes: bytes(text), o200k: countO200k(text) };
        if (anthropic) {
          m.anthropicText = await anthropic.text(text);
          m.anthropicTool = await anthropic.tool(tool, TOOLS[tool].description, schema);
        }
        measurements[variant].tools[tool] = m;
      }
      const keys = Object.keys(measurements[variant].tools[TOOL_NAMES[0]]);
      for (const k of keys) {
        const values = TOOL_NAMES.map((t) => measurements[variant].tools[t][k]);
        measurements[variant].total[k] = values.every((x) => typeof x === 'number')
          ? values.reduce((a, b) => a + b, 0)
          : null;
      }
      const combinedText = minify(TOOL_NAMES.map((t) => wire[variant].inputSchemas[t]));
      measurements[variant].combinedArray = {
        chars: combinedText.length,
        bytes: bytes(combinedText),
        o200k: countO200k(combinedText),
      };
      const responseText = minify(wire[variant].raw);
      measurements[variant].response = {
        chars: responseText.length,
        bytes: bytes(responseText),
        o200k: countO200k(responseText),
        ...(anthropic ? { anthropicText: await anthropic.text(responseText) } : {}),
      };
    }

    // 5. How much each generated JSON Schema enforces on its own (Ajv draft-07).
    const strictness = {};
    for (const variant of VARIANTS) {
      strictness[variant] = {};
      for (const tool of TOOL_NAMES) {
        const validate = ajv.compile(wire[variant].inputSchemas[tool]);
        const { valid, invalid } = CASES[tool];
        strictness[variant][tool] = {
          validAccepted: valid.filter((x) => validate(x)).length,
          valid: valid.length,
          invalidRejected: invalid.filter((x) => !validate(x)).length,
          invalid: invalid.length,
          invalidAcceptedByJsonSchema: invalid.filter((x) => validate(x)),
        };
      }
    }

    // 6. Where the schemas differ.
    const differences = {};
    for (const [a, b] of [['zod', 'valibot'], ['zod_optimized', 'valibot'], ['zod', 'zod_optimized']]) {
      const key = `${a}__vs__${b}`;
      differences[key] = {};
      for (const tool of TOOL_NAMES) {
        const diff = diffSchemas(wire[a].inputSchemas[tool], wire[b].inputSchemas[tool]);
        differences[key][tool] = { diff, summary: summarizeDiff(diff) };
      }
      const all = TOOL_NAMES.flatMap((t) => differences[key][t].diff);
      differences[key].__all = summarizeDiff(all);
    }

    const result = {
      scenario,
      equivalence,
      divergences,
      libraryDefaults,
      measurements,
      strictness,
      differences,
      wireMatchesStandalone: Object.fromEntries(VARIANTS.map((v) => [v, wire[v].matchesStandalone])),
      serverCalls: Object.fromEntries(VARIANTS.map((v) => [v, wire[v].calls])),
    };
    writeJson(path.join(dir, 'measurements.json'), { measurements, strictness });
    writeJson(path.join(dir, 'differences.json'), differences);
    data.scenarios.push(result);
    console.log(`Scenario "${scenario.id}" done.`);
  }

  writeReport(path.join(RESULTS, 'results.md'), data);
  writeJson(path.join(RESULTS, 'summary.json'), data.scenarios.map((s) => ({
    scenario: s.scenario.id,
    totals: Object.fromEntries(VARIANTS.map((v) => [v, s.measurements[v].total])),
    responses: Object.fromEntries(VARIANTS.map((v) => [v, s.measurements[v].response])),
  })));
  console.log('Wrote results/results.md');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
