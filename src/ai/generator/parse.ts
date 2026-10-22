import type { SpecError } from '@/spec/types';

export type ParsedResponse = { raw: string; value: Record<string, unknown>; errors: [] }
  | { raw: string; errors: SpecError[]; value?: never };

export function parseResponse(raw: string): ParsedResponse {
  try {
    const text = raw.replace(/^\s*```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    if (/^\s*(?:\[|"|-?\d|(?:true|false|null)\b)/.test(text)) throw new Error('Expected a JSON object.');
    let start = -1;
    let inQuote = false;
    let prefixEscape = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (inQuote) {
        if (prefixEscape) prefixEscape = false;
        else if (char === '\\') prefixEscape = true;
        else if (char === '"') inQuote = false;
      } else if (char === '"') inQuote = true;
      else if (char === '{' || char === '[') { start = i; break; }
    }
    if (start < 0 || text[start] !== '{') throw new Error('Expected a JSON object.');
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        if (stack.pop() !== (char === '}' ? '{' : '[')) throw new Error('Mismatched JSON brackets.');
        if (!stack.length) {
          const value: unknown = JSON.parse(text.slice(start, i + 1));
          if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected a JSON object.');
          return { raw, value: value as Record<string, unknown>, errors: [] };
        }
      }
    }
    throw new Error('JSON object is incomplete.');
  } catch (error) {
    return { raw, errors: [{ code: 'BAD_JSON', path: '',
      message: error instanceof Error ? error.message : 'Invalid JSON.',
      hint: 'Return one complete valid JSON object, using double quotes and no trailing commas.' }] };
  }
}
