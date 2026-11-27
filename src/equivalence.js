import * as v from 'valibot';
import { isDeepStrictEqual } from 'node:util';
import { CASES } from './cases.js';
import { TOOL_NAMES } from './schemas/meta.js';

/**
 * Runs every shared input through both libraries.
 * Valid inputs must pass in both and produce deep-equal output (defaults applied).
 * Invalid inputs must fail in both.
 * Returns a report; `ok` is false if anything disagreed.
 */
export function checkEquivalence(zodSchemas, valibotSchemas) {
  const report = { ok: true, tools: {} };
  for (const tool of TOOL_NAMES) {
    const { valid, invalid } = CASES[tool];
    const entry = { valid: valid.length, invalid: invalid.length, disagreements: [] };
    const run = (input, expected) => {
      const z = zodSchemas[tool].safeParse(input);
      const vb = v.safeParse(valibotSchemas[tool], input);
      const problem = [];
      if (z.success !== expected) problem.push(`zod ${z.success ? 'accepted' : 'rejected'}`);
      if (vb.success !== expected) problem.push(`valibot ${vb.success ? 'accepted' : 'rejected'}`);
      if (expected && z.success && vb.success && !isDeepStrictEqual(z.data, vb.output)) {
        problem.push('parsed outputs differ');
      }
      if (problem.length) {
        entry.disagreements.push({ expected: expected ? 'valid' : 'invalid', input, problem });
      }
    };
    valid.forEach((input) => run(input, true));
    invalid.forEach((input) => run(input, false));
    if (valid.length < 20 || invalid.length < 20) {
      entry.disagreements.push({ problem: ['fewer than 20 valid or 20 invalid inputs'] });
    }
    if (entry.disagreements.length) report.ok = false;
    report.tools[tool] = entry;
  }
  return report;
}
