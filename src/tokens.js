import { getEncoding } from 'js-tiktoken';
import Anthropic from '@anthropic-ai/sdk';

const o200k = getEncoding('o200k_base');

export const O200K_LABEL = 'o200k_base (js-tiktoken)';

/** Exact token count of a string with OpenAI's o200k_base encoding. */
export function countO200k(text) {
  return o200k.encode(text).length;
}

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

/**
 * Anthropic token counting (POST /v1/messages/count_tokens). Runs only when
 * ANTHROPIC_API_KEY is set. Two numbers per schema:
 *   - text: the minified JSON sent as a user message, minus a baseline
 *     request whose message is "{}", so fixed message overhead cancels out.
 *   - tool: the schema sent as a tool's input_schema, minus the same tool
 *     with input_schema {"type":"object"}, so the tool-use system prompt and
 *     the tool name/description cancel out.
 */
export function createAnthropicCounter() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const cache = new Map();
  const count = async (body) => {
    const key = JSON.stringify(body);
    if (!cache.has(key)) {
      cache.set(
        key,
        client.messages
          .countTokens({ model: ANTHROPIC_MODEL, ...body })
          .then((r) => r.input_tokens),
      );
    }
    return cache.get(key);
  };
  const userMessage = (text) => ({ messages: [{ role: 'user', content: text }] });
  const toolBody = (name, description, inputSchema) => ({
    ...userMessage('Hi'),
    tools: [{ name, description, input_schema: inputSchema }],
  });

  return {
    label: `Anthropic count_tokens API (model ${ANTHROPIC_MODEL})`,
    async text(minified) {
      const [withText, baseline] = await Promise.all([
        count(userMessage(minified)),
        count(userMessage('{}')),
      ]);
      return withText - baseline;
    },
    async tool(name, description, inputSchema) {
      try {
        const [withSchema, baseline] = await Promise.all([
          count(toolBody(name, description, inputSchema)),
          count(toolBody(name, description, { type: 'object' })),
        ]);
        return withSchema - baseline;
      } catch (error) {
        return { error: String(error?.message ?? error) };
      }
    },
  };
}
