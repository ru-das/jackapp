import type { SpecError } from './types';
import { at, own, type AddError, type ValidationContext } from './validation-context';
import { elements } from './validation-elements';
import { actions } from './validation-actions';
import { object, props, structure } from './validation-structure';
import { tree } from './validation-tree';
import { IdentifierSchema, TriggerSchema } from './schema';
import { template } from './validation-values';

export type { ErrorCode, SpecError } from './types';

function nonJson(value: unknown, path: PropertyKey[] = [], ancestors = new Set<object>()): string | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))) return;
  if (typeof value !== 'object' || ancestors.has(value) || path.length > 100
    || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) return at(path);
  const next = new Set(ancestors).add(value);
  for (const [key, entry] of Object.entries(value)) {
    const invalid = nonJson(entry, [...path, Array.isArray(value) ? Number(key) : key], next);
    if (invalid !== undefined) return invalid;
  }
}
// JSON.stringify escapes lone surrogates; paired surrogates encode as four UTF-8 bytes.
function utf8Bytes(text: string): number {
  let size = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    size += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return size;
}
export function validate(input: unknown): SpecError[] {
  const errors: SpecError[] = [];
  const seen = new Set<string>();
  const add: AddError = (code, path, message, hint) => {
    const key = `${code}:${path}`;
    if (!seen.has(key)) { seen.add(key); errors.push({ code, path, message, hint }); }
  };
  let raw: unknown = input;
  if (typeof input === 'string') {
    try { raw = JSON.parse(input) as unknown; }
    catch { add('BAD_JSON', '', 'Could not parse JSON.', 'Return one valid JSON object without code fences.'); return errors; }
  }
  const badJson = nonJson(raw);
  if (badJson !== undefined) {
    const mathPath = badJson.indexOf('.$math');
    if (mathPath >= 0) add('BAD_VALUE', badJson.slice(0, mathPath), 'Invalid or excessively nested math expression.',
      'Use JSON Values with at most 3 nested math nodes.');
    else add('SHAPE', badJson, 'Spec must contain only bounded JSON data.', 'Use finite numbers, strings, booleans, null, arrays and plain objects; no cycles.');
    return errors;
  }
  const serialized = JSON.stringify(raw);
  if (utf8Bytes(serialized) > 32768) {
    add('LIMIT_EXCEEDED', '', 'Spec exceeds 32768 UTF-8 bytes.', 'Compact input JSON including metadata must be at most 32768 bytes before defaults.');
    return errors;
  }
  if (!object(raw)) {
    add('SHAPE', '', 'Spec must be an object.', 'Return the documented v0.1 spec object.'); return errors;
  }
  const { spec, graphValid } = structure(raw, add);
  const invalidProps = props(spec, add);
  const ctx: ValidationContext = {
    spec, add,
    state: (key, path) => {
      if (own(spec.state, key)) return spec.state[key];
      if (object(raw.state) && !own(raw.state, key)) add('UNDECLARED_STATE', path, `State ${key} is not declared.`,
        `Valid state keys: ${Object.keys(spec.state).join(', ') || '(none)'}.`);
    },
    reference: (kind, key, path) => {
      const known = kind === 'screens' ? Array.isArray(raw.screens) && raw.screens.some((screen: unknown) => object(screen) && screen.id === key)
        : object(raw[kind]) && own(raw[kind], key);
      const usable = kind === 'screens' ? spec.screens.some((screen) => screen.id === key) : own(spec[kind], key);
      if (!known && (kind === 'screens' ? Array.isArray(raw.screens) : object(raw[kind]))) {
        add('MISSING_REF', path, `Unknown ${kind} id ${key}.`, `Valid ${kind}: ${kind === 'screens'
          ? spec.screens.map((screen) => screen.id).join(', ') : Object.keys(spec[kind]).join(', ')}.`);
      }
      return usable;
    },
  };
  for (const kind of ['screens', 'triggers'] as const) {
    const entries = raw[kind];
    const ids = new Set<string>();
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry: unknown, i) => {
      if (object(entry) && IdentifierSchema.safeParse(entry.id).success && typeof entry.id === 'string') {
        if (ids.has(entry.id)) add('TREE', `${kind}[${i}].id`, 'Duplicate id.', `Use a unique ${kind} id.`);
        ids.add(entry.id);
      }
      if (kind === 'triggers') {
        const parsed = TriggerSchema.safeParse(entry);
        if (parsed.success) {
          template(ctx, parsed.data.notify.title, `triggers[${i}].notify.title`);
          template(ctx, parsed.data.notify.body, `triggers[${i}].notify.body`);
        }
      }
    });
  }
  if (graphValid) tree(ctx);
  const callers = elements(ctx, invalidProps);
  actions(ctx, callers, raw.actions);
  return errors;
}
