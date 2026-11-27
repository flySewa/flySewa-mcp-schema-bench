import * as z from 'zod';
import * as v from 'valibot';
import { KNOWN_DIVERGENCES } from './cases.js';

// Built-in validators compared directly, without the closest-match fixes the
// benchmark schemas use. This documents why those fixes exist.
const PROBES = [
  {
    label: 'Timestamp: z.iso.datetime({ offset: true }) vs v.isoTimestamp()',
    zod: z.iso.datetime({ offset: true }),
    valibot: v.pipe(v.string(), v.isoTimestamp()),
    inputs: [
      '2026-03-10T14:00:00Z',
      '2026-03-10 14:00:00Z',
      '2026-02-30T14:00:00Z',
      '2026-03-10T14:00:00+0100',
      '2026-03-10T14:00Z',
    ],
    fix: 'Valibot schemas add v.check(isStrictTimestamp).',
  },
  {
    label: 'Date: z.iso.date() vs v.isoDate()',
    zod: z.iso.date(),
    valibot: v.pipe(v.string(), v.isoDate()),
    inputs: ['2024-02-29', '2026-02-29', '2026-02-30', '2026-04-31'],
    fix: 'Valibot schemas add v.check(isStrictDate).',
  },
  {
    label: 'UUID: z.uuid() vs v.uuid()',
    zod: z.uuid(),
    valibot: v.pipe(v.string(), v.uuid()),
    inputs: ['3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b', '00000000-0000-0000-0000-000000000000', 'abcdef12-3456-0890-cbcd-ef1234567890'],
    fix: 'Zod schemas use z.guid(), which matches v.uuid().',
  },
  {
    label: 'UUID: z.guid() vs v.uuid()',
    zod: z.guid(),
    valibot: v.pipe(v.string(), v.uuid()),
    inputs: ['3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b', '00000000-0000-0000-0000-000000000000', 'abcdef12-3456-0890-cbcd-ef1234567890'],
    fix: 'Used in the benchmark.',
  },
  {
    label: 'Unbounded integer: z.int() vs v.integer()',
    zod: z.int(),
    valibot: v.pipe(v.number(), v.integer()),
    inputs: [1, 2 ** 53, 2 ** 60],
    fix: 'Unbounded integers use v.safeInteger(), which matches z.int().',
  },
];

export function runDivergenceProbes(zodSchemas, valibotSchemas) {
  const probes = PROBES.map((p) => ({
    label: p.label,
    fix: p.fix,
    rows: p.inputs.map((input) => ({
      input,
      zod: p.zod.safeParse(input).success,
      valibot: v.safeParse(p.valibot, input).success,
    })),
  }));
  const unresolved = KNOWN_DIVERGENCES.map((d) => ({
    tool: d.tool,
    note: d.note,
    input: d.input,
    zod: zodSchemas[d.tool].safeParse(d.input).success,
    valibot: v.safeParse(valibotSchemas[d.tool], d.input).success,
  }));
  return { probes, unresolved };
}
