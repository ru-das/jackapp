import type { ErrorCode, ListFields, Spec, StateDecl } from './types';

export type ValueType = { type: StateDecl['type']; of?: ListFields };
export type ItemContext = { of: ListFields; list: string };
export type AddError = (code: ErrorCode, path: string, message: string, hint: string) => void;
export type ValidationContext = {
  spec: Spec;
  add: AddError;
  state: (key: string, path: string) => StateDecl | undefined;
  reference: (kind: 'elements' | 'actions' | 'screens', key: string, path: string) => boolean;
};
export const own = (object: object, key: PropertyKey) => Object.hasOwn(object, key);
export const at = (parts: readonly PropertyKey[]): string => parts.reduce<string>((path, part) =>
  typeof part === 'number' ? `${path}[${part}]`
    : /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(String(part)) ? `${path}${path ? '.' : ''}${String(part)}`
      : `${path}[${JSON.stringify(String(part))}]`, '');
export const sameFields = (a: ListFields | undefined, b: ListFields | undefined): boolean =>
  a !== undefined && b !== undefined && Object.keys(a).length === Object.keys(b).length
  && Object.entries(a).every(([key, type]) => own(b, key) && b[key] === type);
export function expectType(ctx: ValidationContext, actual: ValueType | undefined, expected: ValueType, path: string) {
  if (actual && (actual.type !== expected.type || (expected.type === 'list' && !sameFields(actual.of, expected.of)))) {
    ctx.add('TYPE_MISMATCH', path, `Expected ${expected.type}, received ${actual.type}.`,
      `Use ${expected.type}${expected.of ? ` with fields ${JSON.stringify(expected.of)}` : ''}; no numeric coercion.`);
  }
}
export function field(ctx: ValidationContext, of: ListFields, key: string, path: string): ValueType | undefined {
  if (own(of, key)) return { type: of[key] };
  ctx.add('BAD_VALUE', path, `Unknown item field ${key}.`, `Valid fields: ${Object.keys(of).join(', ') || '(none)'}.`);
}
