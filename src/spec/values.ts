import { IsoDateSchema, PathSchema } from './schema';
import type { Aggregate, Value } from './types';

export interface ValueContext {
  state: Readonly<Record<string, unknown>>;
  now: Date;
  locale: string;
  timeZone: string;
  item?: Readonly<Record<string, unknown>>;
  index?: number;
  currency?: string;
  onWarning?: (message: string) => void;
}

function own(object: unknown, key: string): unknown {
  return object !== null && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key)
    ? (object as Record<string, unknown>)[key] : undefined;
}
function reference(path: string, context: ValueContext): unknown {
  if (!PathSchema.safeParse(path).success) return undefined;
  if (path === '$index') return context.index;
  if (path.startsWith('$item.')) return own(context.item, path.slice(6));
  return own(context.state, path);
}
function warn(context: ValueContext, message: string): void {
  context.onWarning?.(message);
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function invalidNumber(context: ValueContext): number {
  warn(context, 'Numeric expressions require finite numbers.');
  return 0;
}
function aggregate(agg: Aggregate, context: ValueContext): number {
  const list = own(context.state, agg.of);
  if (!Array.isArray(list)) return invalidNumber(context);
  const where = agg.where;
  const rows = where ? list.filter((item) => own(item, where.field) === where.equals) : list;
  if (agg.op === 'count') return rows.length;
  if (rows.length === 0) return 0;
  const numbers = rows.map((item) => own(item, agg.field));
  if (!numbers.every(finite)) return invalidNumber(context);
  let result: number;
  switch (agg.op) {
    case 'min': result = numbers.reduce((a, b) => Math.min(a, b)); break;
    case 'max': result = numbers.reduce((a, b) => Math.max(a, b)); break;
    case 'sum': result = numbers.reduce((a, b) => a + b, 0); break;
    case 'avg': result = numbers.reduce((a, b) => a + b, 0) / numbers.length; break;
  }
  return finite(result) ? result : invalidNumber(context);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier); only the date part of each ISO value counts. */
function daysBetween(from: unknown, to: unknown, context: ValueContext): number {
  const day = (value: unknown) => {
    const date = typeof value === 'string' && IsoDateSchema.safeParse(value).success ? value.slice(0, 10) : undefined;
    return date === undefined ? NaN : Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  };
  const days = (day(to) - day(from)) / 86_400_000;
  return Number.isFinite(days) ? Math.round(days) : invalidNumber(context);
}

export function resolveValue(value: Value, context: ValueContext): unknown {
  if (typeof value === 'string') return resolveTemplate(value, context);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if ('$ref' in value) return reference(value.$ref, context);
  if ('$agg' in value) return aggregate(value.$agg, context);
  if ('$now' in value) {
    if (Number.isFinite(context.now.getTime())) return context.now.toISOString();
    warn(context, 'The current date is invalid.');
    return '';
  }
  const [op, a, b] = value.$math;
  const left = resolveValue(a, context);
  const right = resolveValue(b, context);
  if (op === 'days') return daysBetween(left, right, context);
  if (!finite(left) || !finite(right)) return invalidNumber(context);
  if (op === '/' && right === 0) {
    warn(context, 'Division by zero.');
    return 0;
  }
  let result: number;
  switch (op) {
    case '+': result = left + right; break;
    case '-': result = left - right; break;
    case '*': result = left * right; break;
    case '/': result = left / right; break;
    case 'pow': result = left ** right; break;
    case 'min': result = Math.min(left, right); break;
    case 'max': result = Math.max(left, right); break;
    case 'round': {
      if (!Number.isInteger(right)) return invalidNumber(context);
      const factor = 10 ** right;
      if (!finite(factor) || factor === 0) return invalidNumber(context);
      result = Math.round(left * factor) / factor;
      break;
    }
  }
  return finite(result) ? result : invalidNumber(context);
}

const relativeUnits: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400], ['month', 30 * 86400], ['day', 86400],
  ['hour', 3600], ['minute', 60], ['second', 1],
];
function format(value: unknown, formatter: string | undefined, context: ValueContext): string {
  if (value === null || value === undefined) return '';
  try {
    switch (formatter) {
      case undefined:
        if (typeof value === 'string' || typeof value === 'boolean' || finite(value)) return String(value);
        break;
      case 'count':
        if (Array.isArray(value)) return String(value.length);
        break;
      case 'lines':
        // One "- a · b" row per item for sharing; empty and boolean fields are skipped.
        if (Array.isArray(value)) return value.map((row) => `- ${Object.values(row && typeof row === 'object' ? row : {})
          .filter((v) => (typeof v === 'string' && v !== '') || finite(v))
          .map((v) => (typeof v === 'string' && IsoDateSchema.safeParse(v).success ? format(v, 'date', context) : String(v)))
          .join(' · ')}`).join('\n');
        break;
      case 'upper':
        if (typeof value === 'string') return value.toLocaleUpperCase(context.locale);
        break;
      case 'lower':
        if (typeof value === 'string') return value.toLocaleLowerCase(context.locale);
        break;
      case 'fixed2':
        if (finite(value)) return value.toFixed(2);
        break;
      case 'currency':
        if (finite(value) && context.currency) return new Intl.NumberFormat(context.locale, {
          style: 'currency', currency: context.currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(value);
        break;
      case 'date':
      case 'time':
      case 'ago': {
        if (typeof value !== 'string' || !IsoDateSchema.safeParse(value).success) break;
        const date = new Date(value);
        if (formatter === 'ago') {
          const seconds = (date.getTime() - context.now.getTime()) / 1000;
          if (!finite(seconds)) break;
          const [unit, size] = relativeUnits.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1];
          const elapsed = Math.trunc(seconds / size);
          return new Intl.RelativeTimeFormat(context.locale, { numeric: 'always' }).format(elapsed === 0 ? 0 : elapsed, unit);
        }
        return new Intl.DateTimeFormat(context.locale, {
          timeZone: context.timeZone, ...(formatter === 'date' ? { dateStyle: 'medium' } : { timeStyle: 'short' }),
        }).format(date);
      }
    }
  } catch {
    // Intl rejects malformed locale, time zone, and currency settings.
  }
  warn(context, `Cannot format this value${formatter ? ` with ${formatter}` : ''}.`);
  return '';
}

export function resolveTemplate(text: string, context: ValueContext): string {
  // Replace in one pass so state text cannot introduce another expression.
  return text.replace(/\\\{\{|\{\{([^{}]*)\}\}/g, (match: string, body: string | undefined) => {
    if (body === undefined) return '{{';
    const parts = body.split('|').map((part) => part.trim());
    if (parts.length > 2) {
      warn(context, 'Templates accept only one formatter.');
      return '';
    }
    return format(reference(parts[0], context), parts[1], context);
  });
}
