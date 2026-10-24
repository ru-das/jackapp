import { MetaSchema } from '@/spec/schema';
import type { Reminder } from './kit';

// The model's reply is a few "key value" lines. Everything below is forgiving on purpose: a 2B model adds bullets, colons, quotes and prose,
// and a wrong line must fall back to a default, never fail the build.
export type Settings = Map<string, string[]>;

export function readSettings(text: string): Settings {
  const out: Settings = new Map();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^[\s>*\-•\d.)]+/, '').replace(/[*`]/g, '').trim();
    const match = /^([A-Za-z][A-Za-z_ ]{0,20}?)\s*[:=\s]\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().split(/\s+/)[0];
    out.set(key, [...(out.get(key) ?? []), match[2].trim().replace(/^["']+|["']+$/g, '')]);
  }
  return out;
}

export const first = (s: Settings, key: string) => s.get(key)?.[0];

/** Removes what could change meaning inside a spec string: template braces, control characters, runaway length. */
export function cleanText(value: string | undefined, max: number, fallback = ''): string {
  const text = (value ?? '').replace(/[{}\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return text || fallback;
}

export function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (/^(y|yes|true|on|1)\b/i.test(value)) return true;
  if (/^(n|no|none|false|off|0)\b/i.test(value)) return false;
  return fallback;
}

/** camelCase identifier matching the spec's id rule, unique among `taken`. */
export function identifier(value: string | undefined, fallback: string, taken: Iterable<string> = []): string {
  const words = (value ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let id = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
  if (!/^[a-z]/.test(id)) id = fallback;
  id = id.slice(0, 28);
  const used = new Set(taken);
  let unique = id;
  for (let n = 2; used.has(unique); n++) unique = `${id}${n}`;
  return unique;
}

export function icon(value: string | undefined, fallback: string): string {
  const candidate = (value ?? '').match(/\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*/u)?.[0];
  return candidate && MetaSchema.shape.icon.safeParse(candidate).success ? candidate : fallback;
}

/** A readable app name from the request when the model gave none: first few words, title-cased. */
export function nameFromRequest(request: string): string {
  const stop = new Set(['a', 'an', 'the', 'my', 'me', 'i', 'to', 'of', 'for', 'and', 'with', 'make', 'build', 'create', 'app', 'that', 'can', 'let', 'show', 'keep']);
  const words = request.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !stop.has(w)).slice(0, 3);
  return cleanText(words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), 40, 'My App');
}

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function time(text: string): string | undefined {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(text);
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (m[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
  if (m[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  return hour > 23 || minute > 59 ? undefined : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** `none` | `daily 08:00 text` | `weekly 0 09:00 text` (weekday as 0–6 or a day name). */
export function reminder(value: string | undefined, name: string): Reminder | null {
  if (!value || /^(none|no|off|false)\b/i.test(value)) return null;
  const kind = /^weekly|week/i.test(value) ? 'weekly' : /^daily|day|every/i.test(value) ? 'daily' : undefined;
  if (!kind) return null;
  let rest = value.replace(/^\w+\s*/, '');
  let weekday = 0;
  if (kind === 'weekly') {
    const day = /^(\d)\b|^([a-z]{3})/i.exec(rest);
    if (day?.[1] !== undefined) weekday = Math.min(6, Number(day[1]));
    else if (day?.[2]) weekday = Math.max(0, DAYS.indexOf(day[2].toLowerCase()));
    rest = rest.slice(day?.[0].length ?? 0).trim();
  }
  const hhmm = time(rest);
  if (!hhmm) return null;
  const body = cleanText(rest.replace(/^\s*\d{1,2}(?::\d{2})?\s*(am|pm)?/i, ''), 80, `Time for ${name}`);
  return { kind, weekday, time: hhmm, body };
}
