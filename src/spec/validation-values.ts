import { IsoDateSchema, PathSchema } from './schema';
import type { Value, Where, ListFields } from './types';
import { expectType, field, type ItemContext, type ValidationContext, type ValueType } from './validation-context';

export function referenceType(ctx: ValidationContext, ref: string, path: string, item?: ItemContext): ValueType | undefined {
  if (!PathSchema.safeParse(ref).success) {
    ctx.add('BAD_VALUE', path, `Invalid value path ${ref}.`, 'Use a state key, or $item.field / $index inside a List item.');
    return;
  }
  if (ref.startsWith('$')) {
    if (!item) {
      ctx.add('BAD_VALUE', path, 'This value requires a List item context.', 'Call this action only from List.onItemPress; use $item only in List item slots.');
      return;
    }
    return ref === '$index' ? { type: 'number' } : field(ctx, item.of, ref.slice(6), path);
  }
  return ctx.state(ref, path);
}
const formatTypes: Record<string, readonly string[]> = {
  count: ['list'], upper: ['string'], lower: ['string'], currency: ['number'], fixed2: ['number'],
  date: ['date'], time: ['date'], ago: ['date'],
};
export function template(ctx: ValidationContext, text: string, path: string, item?: ItemContext) {
  for (const match of text.matchAll(/\\\{\{|\{\{([^{}]*)\}\}/g)) {
    if (match[1] === undefined) continue;
    const parts = match[1].split('|').map((part) => part.trim());
    if (parts.length > 2 || !parts[0] || (parts.length === 2 && !Object.hasOwn(formatTypes, parts[1]))) {
      ctx.add('BAD_VALUE', path, 'Malformed template expression or unknown formatter.', `Use {{path}} or {{path|formatter}}. Formatters: ${Object.keys(formatTypes).join(', ')}.`);
      continue;
    }
    const type = referenceType(ctx, parts[0], path, item);
    if (type && (parts.length === 2 ? !formatTypes[parts[1]].includes(type.type) : type.type === 'list')) {
      ctx.add('TYPE_MISMATCH', path, `Cannot format ${type.type}${parts[1] ? ` with ${parts[1]}` : ' as plain text'}.`,
        parts[1] ? `Formatter ${parts[1]} accepts ${formatTypes[parts[1]].join(', ')}.` : 'Use count for list length.');
    }
  }
}
// Literal strings keep their type except in explicitly date/image positions.
export function literalFits(value: string | number | boolean | null, type: string): boolean {
  if (type === 'date') return value === null || IsoDateSchema.safeParse(value).success;
  if (type === 'image') return value === null || (typeof value === 'string' && /^(?:data:image\/|file:\/\/)/.test(value));
  return typeof value === type;
}
export function where(ctx: ValidationContext, clause: Where, of: ListFields, path: string) {
  const type = field(ctx, of, clause.field, `${path}.field`);
  if (type && !literalFits(clause.equals, type.type)) {
    ctx.add('TYPE_MISMATCH', `${path}.equals`, 'Filter value has the wrong type.', `Use a ${type.type} literal.`);
  }
}
export function valueType(ctx: ValidationContext, value: Value, path: string, item?: ItemContext): ValueType | undefined {
  if (typeof value === 'string') { template(ctx, value, path, item); return { type: 'string' }; }
  if (typeof value === 'number' || typeof value === 'boolean') return { type: typeof value === 'number' ? 'number' : 'boolean' };
  if ('$ref' in value) return referenceType(ctx, value.$ref, path, item);
  if ('$now' in value) return { type: 'date' };
  if ('$agg' in value) {
    const agg = value.$agg;
    const list = ctx.state(agg.of, `${path}.$agg.of`);
    if (list && list.type !== 'list') expectType(ctx, list, { type: 'list' }, `${path}.$agg.of`);
    if (list?.type === 'list') {
      if (agg.field) {
        const type = field(ctx, list.of, agg.field, `${path}.$agg.field`);
        if (agg.op !== 'count') expectType(ctx, type, { type: 'number' }, `${path}.$agg.field`);
      }
      if (agg.where) where(ctx, agg.where, list.of, `${path}.$agg.where`);
    }
    return { type: 'number' };
  }
  const [op, left, right] = value.$math;
  expectType(ctx, valueType(ctx, left, `${path}.$math[1]`, item), { type: 'number' }, `${path}.$math[1]`);
  expectType(ctx, valueType(ctx, right, `${path}.$math[2]`, item), { type: 'number' }, `${path}.$math[2]`);
  if (op === 'round' && typeof right === 'number' && !Number.isInteger(right)) {
    ctx.add('BAD_VALUE', `${path}.$math[2]`, 'Rounding digits must be an integer.', 'Use an integer literal; check dynamic digits at runtime.');
  }
  return { type: 'number' };
}
export function assignment(ctx: ValidationContext, value: Value, expected: ValueType, path: string, item?: ItemContext) {
  const actual = valueType(ctx, value, path, item);
  if (typeof value === 'string' && ['date', 'image'].includes(expected.type) && literalFits(value, expected.type)) return;
  expectType(ctx, actual, expected, path);
}
