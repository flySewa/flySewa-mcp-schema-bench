import * as z from 'zod';
import { toJsonSchema, toStandardJsonSchema } from '@valibot/to-json-schema';
import { isDeepStrictEqual } from 'node:util';

// MCP TypeScript SDK v2 (2.4.0) converts every Standard Schema itself by calling
//   schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' })
// and passes no other options. See standardSchemaToJsonSchema() in
// node_modules/@modelcontextprotocol/server/dist/src-*.mjs. Every function in
// this file produces a Standard Schema object that the SDK can take as-is, or
// the JSON Schema that the SDK would produce from it.
export const SDK_TARGET = 'draft-2020-12';

/**
 * "Zod optimized" rule: remove the regex `pattern` Zod adds next to string
 * formats (email, date-time, date, uuid...). Only patterns that sit beside a
 * `format` are removed, so hand-written .regex() patterns stay.
 * Written as a Zod `override` hook, which visits every schema node.
 */
export function stripFormatPatterns({ jsonSchema }) {
  if (typeof jsonSchema.format === 'string' && 'pattern' in jsonSchema) {
    delete jsonSchema.pattern;
  }
}

/**
 * Returns a new Standard Schema object that keeps the original
 * `~standard` (vendor, version, validate) but adds `extra` to the
 * `libraryOptions` of every jsonSchema.input / jsonSchema.output call.
 */
function withLibraryOptions(standard, extra) {
  const std = standard['~standard'];
  const wrap = (fn) => (options = {}) =>
    fn({ ...options, libraryOptions: { ...options.libraryOptions, ...extra } });
  return {
    '~standard': {
      ...std,
      jsonSchema: { input: wrap(std.jsonSchema.input), output: wrap(std.jsonSchema.output) },
    },
  };
}

/** Zod optimized for SDK v2: Zod 4.6.7 forwards `libraryOptions` to z.toJSONSchema(). */
export function zodOptimizedStandard(schema) {
  return withLibraryOptions(schema, { override: stripFormatPatterns });
}

// v.check() and v.partialCheck() run custom JavaScript and have no JSON Schema
// equivalent. Every other action must convert, or the run fails.
export const VALIBOT_IGNORE_ACTIONS = ['check', 'partial_check'];

/**
 * Valibot for SDK v2. Workaround for a known issue: toStandardJsonSchema()
 * takes no options and the SDK passes none, so a schema that uses v.check()
 * or v.partialCheck() makes tools/list throw "The check action cannot be
 * converted to JSON Schema". This wrapper adds the ignoreActions option.
 */
export function valibotStandard(schema) {
  return withLibraryOptions(toStandardJsonSchema(schema), {
    ignoreActions: VALIBOT_IGNORE_ACTIONS,
  });
}

/**
 * The JSON Schema the SDK builds from a Standard Schema: the library output,
 * with `type: "object"` placed first (the SDK spreads the result after it).
 */
function asSdk(standard) {
  return { type: 'object', ...standard['~standard'].jsonSchema.input({ target: SDK_TARGET }) };
}

export function zodToJson(schema, { optimized = false } = {}) {
  const sdkPath = asSdk(optimized ? zodOptimizedStandard(schema) : schema);
  // Cross-check against z.toJSONSchema() with the same settings.
  const direct = z.toJSONSchema(schema, {
    target: SDK_TARGET,
    io: 'input',
    ...(optimized ? { override: stripFormatPatterns } : {}),
  });
  if (!isDeepStrictEqual(sdkPath, { type: 'object', ...direct })) {
    throw new Error('Zod ~standard.jsonSchema and z.toJSONSchema disagree');
  }
  return sdkPath;
}

export function valibotToJson(schema) {
  const sdkPath = asSdk(valibotStandard(schema));
  // Cross-check against toJsonSchema() with the same settings.
  const direct = toJsonSchema(schema, {
    target: SDK_TARGET,
    typeMode: 'input',
    ignoreActions: VALIBOT_IGNORE_ACTIONS,
  });
  if (!isDeepStrictEqual(sdkPath, { type: 'object', ...direct })) {
    throw new Error('Valibot toStandardJsonSchema wrapper and toJsonSchema disagree');
  }
  return sdkPath;
}

/** Each library's out-of-the-box call with no options, for reference only. */
export function zodLibraryDefault(schema) {
  return z.toJSONSchema(schema);
}
export function valibotLibraryDefault(schema) {
  return toJsonSchema(schema, { ignoreActions: VALIBOT_IGNORE_ACTIONS });
}

/** Unwrapped toStandardJsonSchema(), used only to show the known issue. */
export function valibotUnwrappedStandard(schema) {
  return toStandardJsonSchema(schema);
}
