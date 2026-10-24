import { assemble, NOW, ref, reminderTrigger, tree, type Obj, type Reminder } from './kit';
import { cleanText, first, flag, icon, identifier, nameFromRequest, reminder, type Settings } from './settings';
import type { Recipe } from './types';

export type FieldType = 'text' | 'number' | 'money' | 'date';
export type LogField = { key: string; label: string; type: FieldType };
export type LogConfig = {
  name: string; icon: string; description: string; noun: string;
  fields: LogField[]; checkbox: boolean;
  total: { field: string; label: string } | null;
  tap: string | null; share: boolean; reminder: Reminder | null;
};

const stateType = { text: 'string', number: 'number', money: 'number', date: 'date' } as const;
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);

export function buildLog(c: LogConfig): Obj {
  const t = tree();
  const title = c.fields.find((f) => f.type === 'text') ?? c.fields[0];
  const typed = c.fields.filter((f) => f.type !== 'date');
  const draft = (f: LogField) => `new${cap(f.key)}`;
  const state: Obj = {
    items: { type: 'list', of: { ...Object.fromEntries(c.fields.map((f) => [f.key, stateType[f.type]])), ...(c.checkbox ? { done: 'boolean' } : {}) }, default: [] },
    ...Object.fromEntries(typed.map((f) => [draft(f), { type: stateType[f.type], default: f.type === 'text' ? '' : 0, persist: false }])),
  };

  const inputs = typed.map((f) => f.type === 'text'
    ? t.add('TextInput', { bind: draft(f), label: f.label, ...(typed.every((x) => x.type === 'text') ? { onSubmit: 'add' } : {}) })
    : t.add('NumberInput', { bind: draft(f), label: f.label, min: 0, mode: f.type === 'money' ? 'field' : 'stepper' }));
  const addButton = t.add('Button', { label: `Add ${c.noun}`, onPress: 'add', variant: 'primary' });
  const addCard = t.add('Card', { title: `New ${c.noun}` }, [...inputs, addButton]);

  const others = c.fields.filter((f) => f !== title);
  const subtitle = others.map((f) => f.type === 'money' ? `{{$item.${f.key}|currency}}`
    : f.type === 'date' ? (f.key === c.tap ? `${f.label}: {{$item.${f.key}|ago}}` : `{{$item.${f.key}|date}}`)
      : f.type === 'number' ? `${f.label}: {{$item.${f.key}}}` : `{{$item.${f.key}}}`).join(' · ');
  const list = t.add('List', {
    items: 'items', title: `{{$item.${title.key}}}`, ...(subtitle ? { subtitle } : {}),
    ...(c.checkbox ? { checkField: 'done' } : {}), deletable: true, ...(c.tap ? { onItemPress: 'record' } : {}),
    emptyText: `Add your first ${c.noun}`,
  });
  const listKids = [list];
  if (c.total) {
    const money = c.fields.find((f) => f.key === c.total?.field)?.type === 'money';
    listKids.push(t.add('Stat', { label: c.total.label, value: { $agg: { op: 'sum', of: 'items', field: c.total.field } }, format: money ? 'currency' : 'number' }));
  }
  if (c.checkbox) listKids.push(t.add('Button', { label: 'Clear done', onPress: 'clearDone', variant: 'secondary' }));
  if (c.share) listKids.push(t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' }));
  const listCard = t.add('Card', { title: `${cap(c.noun)} list` }, listKids);
  const root = t.add('Stack', { gap: 'md' }, [addCard, listCard]);

  const actions: Obj = {
    add: { steps: [
      { op: 'state.append', path: 'items', value: {
        ...Object.fromEntries(c.fields.map((f) => [f.key, f.type === 'date' ? NOW : ref(draft(f))])),
        ...(c.checkbox ? { done: false } : {}) } },
      ...typed.map((f) => ({ op: 'state.reset', path: draft(f) })),
    ] },
    ...(c.tap ? { record: { steps: [{ op: 'state.update', path: 'items', index: ref('$index'), set: { [c.tap]: NOW } }] } } : {}),
    ...(c.checkbox ? { clearDone: { steps: [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }] } } : {}),
    ...(c.share ? { share: { steps: [{ op: 'share', text: `${c.name}: {{items|count}} ${c.noun}s` }] } } : {}),
  };
  return assemble({ name: c.name, description: c.description, icon: c.icon }, state, root, t.elements, actions,
    c.reminder ? [reminderTrigger(c.name, c.reminder)] : []);
}

const TYPES: [RegExp, FieldType][] = [
  [/^(money|price|cost|currency|amount|dollars?|usd|eur|cash|budget)$/, 'money'],
  [/^(number|num|count|int|integer|qty|quantity|minutes?|hours?|mins?)$/, 'number'],
  [/^(date|time|when|datetime|day)$/, 'date'],
  [/^(text|string|name|word|words|note|notes)$/, 'text'],
];
const typeOf = (word: string | undefined) => TYPES.find(([re]) => re.test(word ?? ''))?.[1];

const TYPE_WORD = /^(text|string|number|money|date|time|price|amount|count|integer)$/i;

function parseFields(lines: string[]): LogField[] {
  const out: LogField[] = [];
  for (const line of lines) {
    const words = line.replace(/[:=,|]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length || out.length >= 4) continue;
    const type = typeOf(words[1]?.toLowerCase());
    // A 2B model sometimes repeats the type as the label ("water date date"); show the field name instead.
    const given = cleanText(words.slice(type ? 2 : 1).join(' '), 30);
    const label = !given || TYPE_WORD.test(given) ? cleanText(cap(words[0].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()), 30) : given;
    const key = identifier(words[0], 'name', [...out.map((f) => f.key), 'done', 'items']);
    out.push({ key, label, type: type ?? 'text' });
  }
  return out;
}

export function parseLog(s: Settings, request: string): LogConfig {
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  const noun = cleanText(first(s, 'noun') ?? first(s, 'item'), 24, 'item').toLowerCase();
  let fields = parseFields(s.get('field') ?? []);
  if (!fields.some((f) => f.type === 'text')) fields = [{ key: 'name', label: cap(noun), type: 'text' as FieldType }, ...fields].slice(0, 4);
  const totalWords = (first(s, 'total') ?? '').split(/\s+/).filter(Boolean);
  const totalField = fields.find((f) => f.key === identifier(totalWords[0], '') && (f.type === 'number' || f.type === 'money'))
    ?? (totalWords.length && !/^(none|no|off)$/i.test(totalWords[0]) ? fields.find((f) => f.type === 'number' || f.type === 'money') : undefined);
  const tapWord = identifier((first(s, 'tap') ?? '').split(/\s+/)[0], '');
  let tap = fields.find((f) => f.key === tapWord && f.type === 'date')?.key ?? null;
  if (!tap && first(s, 'tap') && !/^(none|no|off)\b/i.test(first(s, 'tap') ?? '')) {
    const date = fields.find((f) => f.type === 'date');
    if (date) tap = date.key;
    else if (fields.length < 4) { fields.push({ key: 'lastDone', label: 'Last done', type: 'date' }); tap = 'lastDone'; }
  }
  return {
    name, icon: icon(first(s, 'icon'), '📝'), description: cleanText(first(s, 'description'), 140, `Keep track of your ${noun}s`), noun, fields,
    checkbox: flag(first(s, 'checkbox'), false),
    total: totalField ? { field: totalField.key, label: cleanText(totalWords.slice(1).join(' '), 30) || `Total ${totalField.label.toLowerCase()}` } : null,
    tap, share: flag(first(s, 'share'), false), reminder: reminder(first(s, 'reminder'), name),
  };
}

export const logRecipe: Recipe = {
  id: 'log', title: 'List app',
  summary: 'A list the user adds items to with a small form. Each item has up to 4 fields. It can have tick boxes, a running total, a tap-to-record date, a share button and a reminder.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
noun <what one item is called, e.g. expense>
field <key> <text|number|money|date> <label>   (1 to 4 lines; the first text field is the item's title; date = filled with "now" when added)
checkbox <yes|no>   (tick boxes for to-do style lists)
total <field> <label> | none   (sum of a number or money field)
tap <date field> | none   (tapping an item sets that date to now)
share <yes|no>
reminder none | daily HH:MM <text> | weekly <0-6> HH:MM <text>`,
  example: {
    request: 'Log expenses with a name and amount and show the total spent.',
    reply: `name Expense Log
icon 💰
description Log what you spend and see the total
noun expense
field name text Expense
field amount money Amount
checkbox no
total amount Total spent
tap none
share no
reminder none`,
  },
  make: (s, request) => buildLog(parseLog(s, request)),
};
