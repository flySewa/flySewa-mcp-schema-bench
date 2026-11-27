import * as z from 'zod';
import { toJsonSchema, toStandardJsonSchema } from '@valibot/to-json-schema';
import { isDeepStrictEqual } from 'node:util';

// Zod: the same settings the MCP TypeScript SDK 1.32.2 uses internally
// (target draft-7, io "input"), see node_modules/@modelcontextprotocol/sdk/
// dist/esm/server/zod-json-schema-compat.js.
const ZOD_OPTIONS = { target: 'draft-7', io: 'input' };

/**
 * "Zod optimized": removes the regex `pattern` Zod adds next to string
 * formats (email, date-time, date, uuid...). Only patterns that sit beside a
 * `format` are removed, so hand-written .regex() patterns stay.
 */
export function stripFormatPatterns({ jsonSchema }) {
  if (typeof jsonSchema.format === 'string' && 'pattern' in jsonSchema) {
    delete jsonSchema.pattern;
  }
}

export function zodToJson(schema, { optimized = false } = {}) {
  return z.toJSONSchema(schema, {
    ...ZOD_OPTIONS,
    ...(optimized ? { override: stripFormatPatterns } : {}),
  });
}

// Valibot: v.check() and v.partialCheck() run custom JavaScript and have no
// JSON Schema equivalent, so they are explicitly ignored (Zod drops .refine()
// silently). Every other action must convert, or the run fails.
export const VALIBOT_OPTIONS = {
  target: 'draft-07',
  typeMode: 'input',
  ignoreActions: ['check', 'partial_check'],
};

export function valibotToJson(schema) {
  const viaStandard = toStandardJsonSchema(schema)['~standard'].jsonSchema.input({
    target: 'draft-07',
    libraryOptions: { ignoreActions: VALIBOT_OPTIONS.ignoreActions },
  });
  const direct = toJsonSchema(schema, VALIBOT_OPTIONS);
  if (!isDeepStrictEqual(viaStandard, direct)) {
    throw new Error('toStandardJsonSchema and toJsonSchema disagree');
  }
  return direct;
}

/** Each library's out-of-the-box call with no options, for reference only. */
export function zodLibraryDefault(schema) {
  return z.toJSONSchema(schema);
}
export function valibotLibraryDefault(schema) {
  return toJsonSchema(schema, { ignoreActions: VALIBOT_OPTIONS.ignoreActions });
}
