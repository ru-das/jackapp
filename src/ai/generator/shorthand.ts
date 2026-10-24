// Short spellings for the values a small model gets wrong most often when it has to write nested JSON (ADR-024).
// JSON is always accepted too; the writers below fall back to it whenever a value has no short form.
type Obj = Record<string, unknown>;

export const LITERAL = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/;
const SCALAR_TYPES = ['string', 'number', 'boolean', 'date', 'image'];
const FIELD_TYPES = ['string', 'number', 'boolean', 'date'];
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const MAP_KEYS = (key: string, op?: string) => key === 'defaults' || key === 'set' || (key === 'value' && op === 'state.append');

/** Splits on commas outside quotes, braces and brackets. */
function splitTop(text: string) {
  const out: string[] = [];
  let cur = '', depth = 0, quote = false, escaped = false;
  for (const ch of text) {
    if (quote) {
      if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false;
    } else if (ch === '"') quote = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  return [...out, cur];
}

function scalar(text: string): unknown {
  if (text === '@now') return { $now: true };
  if (/^@[\w$][\w$.]*$/.test(text)) return { $ref: text.slice(1) };
  return /^["{[]/.test(text) || LITERAL.test(text) ? JSON.parse(text) : text;
}

function inlineMap(text: string) {
  return Object.fromEntries(splitTop(text).map((entry) => {
    const at = entry.indexOf(':');
    if (at <= 0) throw new Error(`Expected name:value in ${entry}`);
    return [entry.slice(0, at), scalar(entry.slice(at + 1))];
  }));
}

/** `op` is set only on action steps: key-based shorthands (output, where, defaults, set) are meaningful there and nowhere else. */
export function parseValue(key: string, text: string, op?: string): unknown {
  if (op !== undefined && !/^["{[]/.test(text)) {
    if (key === 'output') {
      if (SCALAR_TYPES.includes(text)) return { type: text };
      if (text.startsWith('list:')) {
        return { type: 'list', of: Object.fromEntries(splitTop(text.slice(5)).map((field) => {
          const [name, type] = field.split(':');
          if (!name || !type) throw new Error(`Expected name:type in ${field}`);
          return [name, type];
        })) };
      }
    }
    if (key === 'where') {
      const [[field, equals], ...more] = Object.entries(inlineMap(text));
      if (more.length) throw new Error('where takes one field:value');
      return { field, equals };
    }
    if (MAP_KEYS(key, op) && text.includes(':')) return inlineMap(text);
  }
  return scalar(text);
}

// A bare word needs no quotes; commas are reserved inside maps.
const bare = (text: string, inMap: boolean) =>
  new RegExp(inMap ? '^[^\\s"{}[\\],]+$' : '^[^\\s"{}[\\]]+$').test(text) && text !== '>' && !LITERAL.test(text) && !text.startsWith('@');

function short(value: unknown, inMap = false): string | undefined {
  if (isObj(value) && Object.keys(value).length === 1) {
    if (value.$now === true) return '@now';
    if (typeof value.$ref === 'string' && /^[\w$][\w$.]*$/.test(value.$ref)) return `@${value.$ref}`;
  }
  if (typeof value === 'string') return bare(value, inMap) ? value : JSON.stringify(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  return undefined;
}

export function formatValue(key: string, value: unknown, op?: string): string {
  if (op !== undefined && isObj(value)) {
    const keys = Object.keys(value);
    if (key === 'output' && keys.length === 1 && typeof value.type === 'string' && SCALAR_TYPES.includes(value.type)) return value.type;
    if (key === 'output' && value.type === 'list' && keys.length === 2 && isObj(value.of)
      && Object.values(value.of).every((type) => FIELD_TYPES.includes(String(type)))) {
      return `list:${Object.entries(value.of).map(([name, type]) => `${name}:${String(type)}`).join(',')}`;
    }
    if (key === 'where' && keys.length === 2 && typeof value.field === 'string' && /^\w+$/.test(value.field)
      && ['string', 'number', 'boolean'].includes(typeof value.equals)) return `${value.field}:${short(value.equals, true)}`;
    if (MAP_KEYS(key, op) && keys.length && keys.every((name) => /^\w+$/.test(name))) {
      const parts = Object.entries(value).map(([name, item]) => [name, short(item, true)] as const);
      if (parts.every(([, text]) => text !== undefined)) return parts.map(([name, text]) => `${name}:${text}`).join(',');
    }
  }
  return short(value) ?? JSON.stringify(value);
}
