import fs from 'node:fs';
import { TOOL_NAMES } from './schemas/meta.js';
import { O200K_LABEL } from './tokens.js';

const V = ['zod', 'zod_optimized', 'valibot'];
const NAME = { zod: 'Zod', zod_optimized: 'Zod optimized', valibot: 'Valibot' };

/** Percentage change from `base` to `value`, one decimal, signed. */
export function pct(base, value) {
  if (typeof base !== 'number' || typeof value !== 'number' || base === 0) return 'n/a';
  const p = ((value - base) / base) * 100;
  const r = Math.round(p * 10) / 10;
  return `${r > 0 ? '+' : ''}${r.toFixed(1)}%`;
}

const table = (header, rows) =>
  [
    `| ${header.join(' | ')} |`,
    `| ${header.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

function metricTable(m, key) {
  const rows = TOOL_NAMES.map((t) => {
    const [z, zo, vb] = V.map((x) => m[x].tools[t][key]);
    return [`\`${t}\``, z, zo, vb, pct(z, vb), pct(zo, vb), pct(z, zo)];
  });
  const [z, zo, vb] = V.map((x) => m[x].total[key]);
  rows.push(['**Total (5 tools)**', `**${z}**`, `**${zo}**`, `**${vb}**`, `**${pct(z, vb)}**`, `**${pct(zo, vb)}**`, `**${pct(z, zo)}**`]);
  return table(
    ['Tool', 'Zod', 'Zod optimized', 'Valibot', 'Valibot vs Zod', 'Valibot vs Zod optimized', 'Zod optimized vs Zod'],
    rows,
  );
}

function scenarioSection(s, anthropicLabel) {
  const m = s.measurements;
  const out = [];
  out.push(`## Scenario: ${s.scenario.label} (\`${s.scenario.id}\`)`);
  out.push('');
  out.push(
    'All numbers measure the `inputSchema` object of each tool exactly as it arrived in the `tools/list` response, serialised with `JSON.stringify` (minified). A negative percentage means the right-hand variant is smaller.',
  );
  out.push('');
  out.push('### Size: characters (minified)');
  out.push('');
  out.push(metricTable(m, 'chars'));
  out.push('');
  out.push('### Size: bytes (minified, UTF-8)');
  out.push('');
  out.push(metricTable(m, 'bytes'));
  out.push('');
  out.push(`### Tokens: ${O200K_LABEL}`);
  out.push('');
  out.push(`Tokenizer: \`o200k_base\` from js-tiktoken. This is OpenAI's encoding (GPT-4o family), not Claude's.`);
  out.push('');
  out.push(metricTable(m, 'o200k'));
  out.push('');
  const combined = V.map((x) => m[x].combinedArray.o200k);
  out.push(
    `Combined as one JSON array of all five schemas (tokenized once, ${O200K_LABEL}): Zod ${combined[0]}, Zod optimized ${combined[1]}, Valibot ${combined[2]} (Valibot vs Zod ${pct(combined[0], combined[2])}, Valibot vs Zod optimized ${pct(combined[1], combined[2])}).`,
  );
  out.push('');
  if (anthropicLabel) {
    out.push(`### Tokens: ${anthropicLabel}, schema as message text`);
    out.push('');
    out.push('Minified schema sent as a user message, minus a baseline request whose message is `{}`.');
    out.push('');
    out.push(metricTable(m, 'anthropicText'));
    out.push('');
    out.push(`### Tokens: ${anthropicLabel}, schema as a tool definition`);
    out.push('');
    out.push(
      'Schema sent as the tool\'s `input_schema`, minus the same tool with `input_schema: {"type":"object"}`. Cells show an error message if the API rejected the schema.',
    );
    out.push('');
    out.push(metricTable(m, 'anthropicTool'));
    out.push('');
  } else {
    out.push(
      '_Anthropic token counts: not measured in this run because `ANTHROPIC_API_KEY` was not set._',
    );
    out.push('');
  }

  out.push('### Full `tools/list` response (all five tools, minified JSON-RPC message)');
  out.push('');
  const r = V.map((x) => m[x].response);
  const rows = [
    ['Characters', ...r.map((x) => x.chars), pct(r[0].chars, r[2].chars), pct(r[1].chars, r[2].chars)],
    ['Bytes', ...r.map((x) => x.bytes), pct(r[0].bytes, r[2].bytes), pct(r[1].bytes, r[2].bytes)],
    [`Tokens (${O200K_LABEL})`, ...r.map((x) => x.o200k), pct(r[0].o200k, r[2].o200k), pct(r[1].o200k, r[2].o200k)],
  ];
  if (anthropicLabel) {
    rows.push([`Tokens (${anthropicLabel}, as text)`, ...r.map((x) => x.anthropicText), pct(r[0].anthropicText, r[2].anthropicText), pct(r[1].anthropicText, r[2].anthropicText)]);
  }
  out.push(table(['Metric', 'Zod', 'Zod optimized', 'Valibot', 'Valibot vs Zod', 'Valibot vs Zod optimized'], rows));
  out.push('');
  out.push(
    'The default Zod server uses the SDK\'s high-level `McpServer`, which adds `"execution":{"taskSupport":"forbidden"}` to every tool (about 40 characters each). The Zod optimized and Valibot servers use the low-level `Server` and do not add it. This envelope difference is unrelated to the schema library and is why the response gap is larger than the schema gap.',
  );
  out.push('');

  out.push('### Where the schemas differ');
  out.push('');
  for (const [key, title] of [
    ['zod__vs__valibot', 'Zod vs Valibot'],
    ['zod_optimized__vs__valibot', 'Zod optimized vs Valibot'],
  ]) {
    const [a, b] = key.split('__vs__');
    const groups = s.differences[key].__all;
    out.push(`**${title}** (key order ignored):`);
    out.push('');
    if (!groups.length) {
      out.push('- No structural differences.');
    }
    for (const g of groups) {
      const side = g.kind === 'only_a' ? `only in ${NAME[a]}` : g.kind === 'only_b' ? `only in ${NAME[b]}` : 'different value';
      const chars = g.kind === 'only_a' ? g.charsA : g.kind === 'only_b' ? g.charsB : `${g.charsA} vs ${g.charsB}`;
      const where = [...new Set(s.differences[key] && TOOL_NAMES.flatMap((t) => s.differences[key][t].diff.filter((d) => d.path.endsWith(`/${g.key}`) && d.kind === g.kind).map((d) => `${t}${d.path}`)))];
      out.push(`- \`${g.key}\` ${side}: ${g.count} occurrence(s), about ${chars} characters. Locations: ${where.map((w) => `\`${w}\``).join(', ')}`);
    }
    out.push('');
  }
  out.push(
    'Beyond those keywords the schemas carry the same constraints. Key order differs (Zod writes `$schema` first, Valibot last; Valibot writes `type` after `enum`), which does not change character counts but can change token counts by a token or two.',
  );
  out.push('');

  out.push('### What each JSON Schema enforces on its own');
  out.push('');
  out.push(
    'Each `inputSchema` from `tools/list` compiled with Ajv (draft-07, ajv-formats) and run against the same inputs used for the equivalence check. This shows how much of the server-side validation a client or model could learn from the JSON Schema alone. Both libraries still validate every call on the server.',
  );
  out.push('');
  const srows = TOOL_NAMES.map((t) => [
    `\`${t}\``,
    ...V.map((x) => {
      const st = s.strictness[x][t];
      return `${st.validAccepted}/${st.valid} valid accepted, ${st.invalidRejected}/${st.invalid} invalid rejected`;
    }),
  ]);
  out.push(table(['Tool', 'Zod', 'Zod optimized', 'Valibot'], srows));
  out.push('');
  out.push('Invalid inputs that pass the JSON Schema but are rejected by the library on the server:');
  out.push('');
  for (const x of V) {
    for (const t of TOOL_NAMES) {
      for (const input of s.strictness[x][t].invalidAcceptedByJsonSchema) {
        out.push(`- ${NAME[x]}, \`${t}\`: \`${JSON.stringify(input)}\``);
      }
    }
  }
  out.push('');

  out.push('### Library defaults outside MCP (reference only)');
  out.push('');
  out.push(
    `Calling each converter with no options: \`z.toJSONSchema(schema)\` (Zod default target draft 2020-12, io "output", which adds \`additionalProperties: false\`) and \`toJsonSchema(schema, { ignoreActions })\` (Valibot default draft-07). These are not what an MCP client receives. Total characters: Zod ${s.libraryDefaults.zod.chars}, Valibot ${s.libraryDefaults.valibot.chars} (${pct(s.libraryDefaults.zod.chars, s.libraryDefaults.valibot.chars)}). Total ${O200K_LABEL} tokens: Zod ${s.libraryDefaults.zod.o200k}, Valibot ${s.libraryDefaults.valibot.o200k} (${pct(s.libraryDefaults.zod.o200k, s.libraryDefaults.valibot.o200k)}).`,
  );
  out.push('');
  out.push(
    `Sanity checks: the \`inputSchema\` in \`tools/list\` is byte-for-byte the same object as the standalone conversion for every variant: ${V.map((x) => `${NAME[x]} ${s.wireMatchesStandalone[x] ? 'yes' : 'NO'}`).join(', ')}.`,
  );
  out.push('');
  return out.join('\n');
}

export function writeReport(file, data) {
  const { env, scenarios, anthropicLabel } = data;
  const first = scenarios[0];
  const out = [];
  out.push('# Results: JSON Schema size of MCP tool inputs, Zod vs Valibot');
  out.push('');
  out.push('Generated by `npm run bench`. Do not edit by hand; rerun the benchmark instead.');
  out.push('');
  out.push('## Environment');
  out.push('');
  out.push(`- Node.js ${env.node}`);
  out.push(`- OS: ${env.os}`);
  for (const [n, ver] of Object.entries(env.packages)) out.push(`- \`${n}\` ${ver}`);
  out.push('');
  out.push('## Tokenizers used');
  out.push('');
  out.push(`- \`${O200K_LABEL}\`: every token number labelled o200k_base.`);
  out.push(
    anthropicLabel
      ? `- ${anthropicLabel}: every number labelled Anthropic.`
      : '- Anthropic count_tokens API: not run (`ANTHROPIC_API_KEY` not set).',
  );
  out.push('- No number in this report is a characters-to-tokens estimate.');
  out.push('');

  out.push('## Headline (sum of the five tools\' `inputSchema`, as received via `tools/list`)');
  out.push('');
  const hrows = [];
  for (const s of scenarios) {
    const t = V.map((x) => s.measurements[x].total);
    hrows.push([`${s.scenario.label}: characters`, ...t.map((x) => x.chars), pct(t[0].chars, t[2].chars), pct(t[1].chars, t[2].chars)]);
    hrows.push([`${s.scenario.label}: o200k_base tokens`, ...t.map((x) => x.o200k), pct(t[0].o200k, t[2].o200k), pct(t[1].o200k, t[2].o200k)]);
    if (anthropicLabel) {
      hrows.push([`${s.scenario.label}: Anthropic tokens (tool definition)`, ...t.map((x) => x.anthropicTool ?? 'error'), pct(t[0].anthropicTool, t[2].anthropicTool), pct(t[1].anthropicTool, t[2].anthropicTool)]);
    }
  }
  out.push(table(['Measure', 'Zod', 'Zod optimized', 'Valibot', 'Valibot vs Zod', 'Valibot vs Zod optimized'], hrows));
  out.push('');

  out.push('## Equivalence check');
  out.push('');
  out.push(
    'Before measuring, every tool is run through both libraries with the same inputs. Valid inputs must pass in both with deep-equal parsed output (defaults applied). Invalid inputs must fail in both. The run stops on any disagreement.',
  );
  out.push('');
  out.push(
    table(
      ['Tool', 'Valid inputs', 'Invalid inputs', 'Disagreements'],
      TOOL_NAMES.map((t) => {
        const e = first.equivalence.tools[t];
        return [`\`${t}\``, e.valid, e.invalid, e.disagreements.length];
      }),
    ),
  );
  out.push('');
  out.push('### Closest-match adjustments and known differences');
  out.push('');
  out.push('Built-in validators compared directly (✓ accepted, ✗ rejected):');
  out.push('');
  for (const p of first.divergences.probes) {
    out.push(`**${p.label}**. ${p.fix}`);
    out.push('');
    out.push(table(['Input', 'Zod', 'Valibot'], p.rows.map((r) => [`\`${JSON.stringify(r.input)}\``, r.zod ? '✓' : '✗', r.valibot ? '✓' : '✗'])));
    out.push('');
  }
  out.push('Unresolved differences (excluded from the pass/fail check, kept here so they are visible):');
  out.push('');
  for (const u of first.divergences.unresolved) {
    out.push(`- \`${u.tool}\` with \`${JSON.stringify(u.input)}\`: Zod ${u.zod ? 'accepts' : 'rejects'}, Valibot ${u.valibot ? 'accepts' : 'rejects'}. ${u.note}`);
  }
  out.push('');

  for (const s of scenarios) out.push(scenarioSection(s, anthropicLabel));
  fs.writeFileSync(file, `${out.join('\n').trimEnd()}\n`);
}
