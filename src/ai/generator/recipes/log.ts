import { assemble, NOW, ref, reminderTrigger, tree, type Obj, type Reminder } from './kit';
import { cleanText, first, flag, icon, identifier, nameFromRequest, reminder, type Settings } from './settings';
import type { Recipe } from './types';

export type FieldType = 'text' | 'longtext' | 'number' | 'money' | 'date' | 'day' | 'choice' | 'rating';
export type LogField = { key: string; label: string; type: FieldType; options?: string[] };
export type TotalOp = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type LogTotal = { op: TotalOp; field?: string; label: string };
export type LogTap = { kind: 'date' | 'add'; field: string } | null;
export type LogConfig = {
  name: string; icon: string; description: string; noun: string;
  fields: LogField[]; checkbox: boolean; totals: LogTotal[]; tap: LogTap;
  sort: { field: string; dir: 'asc' | 'desc' } | null; share: boolean; reminder: Reminder | null;
};

const stateType = { text: 'string', longtext: 'string', choice: 'string', number: 'number', money: 'number', rating: 'number', date: 'date', day: 'date' } as const;
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);
const numeric = (f: LogField) => f.type === 'number' || f.type === 'money' || f.type === 'rating';

export function buildLog(c: LogConfig): Obj {
  const t = tree();
  const title = c.fields.find((f) => f.type === 'text') ?? c.fields[0];
  const typed = c.fields.filter((f) => f.type !== 'date');
  const draft = (f: LogField) => `new${cap(f.key)}`;
  const dateTap = c.tap?.kind === 'date' ? c.tap : null;
  const draftDefault = (f: LogField) => f.type === 'choice' ? (f.options ?? [''])[0] : f.type === 'rating' ? 3 : f.type === 'day' ? null : f.type === 'text' || f.type === 'longtext' ? '' : 0;
  const state: Obj = {
    items: { type: 'list', of: { ...Object.fromEntries(c.fields.map((f) => [f.key, stateType[f.type]])), ...(c.checkbox ? { done: 'boolean' } : {}) }, default: [] },
    ...Object.fromEntries(typed.map((f) => [draft(f), { type: stateType[f.type], default: draftDefault(f), persist: false }])),
    ...(dateTap ? {
      selIndex: { type: 'number', default: 0, persist: false }, selName: { type: 'string', default: '', persist: false },
      selWhen: { type: 'date', default: null, persist: false }, prevWhen: { type: 'date', default: null, persist: false },
      pickDay: { type: 'date', default: null, persist: false },
    } : {}),
  };

  const inputs = typed.map((f) => {
    if (f.type === 'text') return t.add('TextInput', { bind: draft(f), label: f.label, ...(typed.every((x) => x.type === 'text') ? { onSubmit: 'add' } : {}) });
    if (f.type === 'longtext') return t.add('TextInput', { bind: draft(f), label: f.label, multiline: true });
    if (f.type === 'choice') return t.add('Select', { bind: draft(f), label: f.label, options: f.options });
    if (f.type === 'rating') return t.add('NumberInput', { bind: draft(f), label: f.label, min: 1, max: 5, mode: 'slider' });
    if (f.type === 'day') return t.add('DateInput', { bind: draft(f), label: f.label });
    return t.add('NumberInput', { bind: draft(f), label: f.label, min: 0, mode: f.type === 'money' ? 'field' : 'stepper' });
  });
  const addButton = t.add('Button', { label: `Add ${c.noun}`, onPress: 'add', variant: 'primary' });
  const addCard = t.add('Card', { title: `New ${c.noun}` }, [...inputs, addButton]);

  const others = c.fields.filter((f) => f !== title);
  const part = (f: LogField) => {
    const v = `{{$item.${f.key}}}`;
    if (f.type === 'money') return `{{$item.${f.key}|currency}}`;
    if (f.type === 'day') return `${f.label}: {{$item.${f.key}|date}}`;
    if (f.type === 'date') return c.tap?.kind === 'date' && c.tap.field === f.key ? `${f.label}: {{$item.${f.key}|ago}}` : `{{$item.${f.key}|date}}`;
    return f.type === 'number' || f.type === 'rating' ? `${f.label}: ${v}` : v;
  };
  const subtitle = others.map(part).join(' · ');
  const list = t.add('List', {
    items: 'items', title: `{{$item.${title.key}}}`, ...(subtitle ? { subtitle } : {}),
    ...(c.checkbox ? { checkField: 'done' } : {}), deletable: true, ...(c.tap ? { onItemPress: dateTap ? 'open' : 'record' } : {}),
    ...(c.sort ? { sort: c.sort } : {}), emptyText: `Add your first ${c.noun}`,
  });
  const listKids = dateTap ? [t.add('Text', { value: `Tap a ${c.noun} to log it or fix the date.`, variant: 'muted' }), list] : [list];
  for (const total of c.totals) {
    const field = c.fields.find((f) => f.key === total.field);
    listKids.push(t.add('Stat', {
      label: total.label, format: field?.type === 'money' && total.op !== 'count' ? 'currency' : 'number',
      value: { $agg: total.op === 'count' ? { op: 'count', of: 'items' } : { op: total.op, of: 'items', field: total.field } },
    }));
  }
  if (c.checkbox) listKids.push(t.add('Button', { label: 'Clear done', onPress: 'clearDone', variant: 'secondary' }));
  if (c.share) listKids.push(t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' }));
  const listCard = t.add('Card', { title: `${cap(c.noun)} list` }, listKids);
  const root = t.add('Stack', { gap: 'md' }, [addCard, listCard]);

  const dateField = c.fields.find((f) => f.type === 'date');
  const tapField = dateTap ? c.fields.find((f) => f.key === dateTap.field)! : null;
  const verb = /^last\s+(\w+)/i.exec(tapField?.label ?? '')?.[1];
  const nowLabel = verb ? `${cap(verb.toLowerCase())} now` : 'Mark done now';
  const when = (field: string, value: unknown) => ({ op: 'state.update', path: 'items', index: ref('selIndex'), set: { [field]: value } });
  const itemScreen = !dateTap ? [] : [{ id: 'item', title: cap(c.noun), root: t.add('Stack', { gap: 'md' }, [t.add('Card', { title: '{{selName}}' }, [
    t.add('Stat', { label: tapField!.label, value: ref('selWhen'), format: 'ago' }),
    t.add('Text', { value: '{{selWhen|date}}', variant: 'muted' }),
    t.add('Button', { label: nowLabel, onPress: 'now', variant: 'primary' }),
    t.add('Button', { label: 'Undo last change', onPress: 'undo', variant: 'secondary' }),
    t.add('DateInput', { bind: 'pickDay', label: 'Or pick the day' }),
    t.add('Button', { label: 'Save that day', onPress: 'saveDay', variant: 'secondary' }),
  ])]) }];
  const record = c.tap?.kind === 'add'
    ? { [c.tap.field]: { $math: ['+', ref(`$item.${c.tap.field}`), 1] }, ...(dateField ? { [dateField.key]: NOW } : {}) }
    : undefined;
  const actions: Obj = {
    add: { steps: [
      { op: 'state.append', path: 'items', ...(title.type === 'text' ? { required: [title.key] } : {}), value: {
        ...Object.fromEntries(c.fields.map((f) => [f.key, f.type === 'date' ? NOW : ref(draft(f))])),
        ...(c.checkbox ? { done: false } : {}) } },
      ...typed.map((f) => ({ op: 'state.reset', path: draft(f) })),
    ] },
    ...(dateTap ? {
      open: { steps: [
        { op: 'state.set', path: 'selIndex', value: ref('$index') }, { op: 'state.set', path: 'selName', value: ref(`$item.${title.key}`) },
        { op: 'state.set', path: 'selWhen', value: ref(`$item.${dateTap.field}`) }, { op: 'state.set', path: 'prevWhen', value: ref(`$item.${dateTap.field}`) },
        { op: 'state.set', path: 'pickDay', value: ref(`$item.${dateTap.field}`) }, { op: 'navigate', screen: 'item' }] },
      now: { steps: [{ op: 'state.set', path: 'prevWhen', value: ref('selWhen') }, when(dateTap.field, NOW), { op: 'state.set', path: 'selWhen', value: NOW },
        { op: 'state.set', path: 'pickDay', value: NOW }, { op: 'toast', message: 'Saved' }] },
      saveDay: { steps: [{ op: 'state.set', path: 'prevWhen', value: ref('selWhen') }, when(dateTap.field, ref('pickDay')),
        { op: 'state.set', path: 'selWhen', value: ref('pickDay') }, { op: 'toast', message: 'Saved' }] },
      undo: { steps: [when(dateTap.field, ref('prevWhen')), { op: 'state.set', path: 'selWhen', value: ref('prevWhen') }, { op: 'toast', message: 'Undone' }] },
    } : {}),
    ...(record ? { record: { steps: [{ op: 'state.update', path: 'items', index: ref('$index'), set: record }] } } : {}),
    ...(c.checkbox ? { clearDone: { steps: [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }] } } : {}),
    ...(c.share ? { share: { steps: [{ op: 'share', text: `${c.name}: {{items|count}} ${c.noun}s` }] } } : {}),
  };
  return assemble({ name: c.name, description: c.description, icon: c.icon }, state, root, t.elements, actions,
    c.reminder ? [reminderTrigger(c.name, c.reminder)] : [], itemScreen);
}

const TYPES: [RegExp, FieldType][] = [
  [/^(money|price|cost|currency|amount|dollars?|usd|eur|cash|budget)$/, 'money'],
  [/^(number|num|count|int|integer|qty|quantity|minutes?|hours?|mins?|weight|distance)$/, 'number'],
  [/^(day|due|deadline|birthday|dob)$/, 'day'],
  [/^(date|time|when|datetime)$/, 'date'],
  [/^(rating|stars?|rank)$/, 'rating'],
  [/^(choice|select|dropdown|status|option|options|category|priority|mood)$/, 'choice'],
  [/^(longtext|long|multiline|paragraph|description|notes?|journal|comment|memo|body)$/, 'longtext'],
  [/^(text|string|name|word|words)$/, 'text'],
];
const typeOf = (word: string | undefined) => TYPES.find(([re]) => re.test(word ?? ''))?.[1];
const TYPE_WORD = /^(text|string|number|money|date|day|time|price|amount|count|integer|choice|select|rating|longtext)$/i;
const DEFAULT_OPTIONS = ['To do', 'In progress', 'Done'];

function options(tokens: string[]): { label: string; options: string[] | undefined } {
  const at = tokens.findIndex((t) => t.includes('|') || /^options?$/i.test(t));
  if (at < 0) return { label: tokens.join(' '), options: undefined };
  const list = tokens.slice(at).join(' ').replace(/^options?\s*/i, '').split(/[|,]/).map((o) => cleanText(o, 24)).filter(Boolean);
  return { label: tokens.slice(0, at).join(' '), options: [...new Set(list)].slice(0, 12) };
}

function parseFields(lines: string[], notes: string[]): LogField[] {
  const out: LogField[] = [];
  for (const line of lines) {
    const words = line.replace(/[:=]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (out.length >= 4) { notes.push(`Only 4 fields fit, so “${words[0]}” was left out.`); continue; }
    const type = typeOf(words[1]?.toLowerCase());
    const { label: rawLabel, options: choices } = options(words.slice(type ? 2 : 1));
    // A 2B model sometimes repeats the type as the label ("water date date"); show the field name instead.
    const given = cleanText(rawLabel, 30);
    const label = !given || TYPE_WORD.test(given) ? cleanText(cap(words[0].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()), 30) : given;
    // A deadline or birthday is something the user types in; an entry date is stamped when the item is added.
    const kind = type === 'date' && /^(due|deadline|birth|dob|start|end|expir|event|appointment)/i.test(words[0]) ? 'day' : (type ?? 'text');
    const key = identifier(words[0], 'name', [...out.map((f) => f.key), 'done', 'items']);
    out.push({ key, label, type: kind, ...(kind === 'choice' ? { options: choices && choices.length >= 2 ? choices : DEFAULT_OPTIONS } : {}) });
  }
  return out;
}

const OPS: [RegExp, TotalOp][] = [[/^(sum|total)$/i, 'sum'], [/^(avg|average|mean)$/i, 'avg'], [/^(min|minimum|lowest|least)$/i, 'min'], [/^(max|maximum|highest|most)$/i, 'max'], [/^count$/i, 'count']];

const OP_WORD: Record<TotalOp, string> = { sum: 'Total', avg: 'Average', min: 'Lowest', max: 'Highest', count: 'Count' };

function parseTotals(lines: string[], fields: LogField[], notes: string[]): LogTotal[] {
  const out: LogTotal[] = [];
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length || /^(none|no|off)$/i.test(words[0]) || out.length >= 3) continue;
    const op = OPS.find(([re]) => re.test(words[0]))?.[1];
    const rest = op ? words.slice(1) : words;
    if (op === 'count' || (!op && /^count/i.test(words[0]))) { out.push({ op: 'count', label: cleanText(rest.join(' '), 30) || 'How many' }); continue; }
    const key = identifier(rest[0], '');
    const field = fields.find((f) => f.key === key && numeric(f)) ?? (rest.length || op ? fields.find(numeric) : undefined);
    if (!field) { notes.push(`Couldn’t add the total “${line}”: no number field to add up.`); continue; }
    const label = cleanText((fields.some((f) => f.key === key) ? rest.slice(1) : rest).join(' '), 30);
    const chosen = op ?? 'sum';
    out.push({ op: chosen, field: field.key, label: label || `${OP_WORD[chosen]} ${field.label.toLowerCase()}` });
  }
  return out;
}

function parseTap(value: string | undefined, fields: LogField[]): { tap: LogTap; fields: LogField[] } {
  if (!value || /^(none|no|off)\b/i.test(value)) return { tap: null, fields };
  const words = value.split(/\s+/).filter(Boolean);
  const kind = /^(add|plus|increase|count)$/i.test(words[0]) ? 'add' : 'date';
  const key = identifier(kind === 'add' || /^(date|set|now)$/i.test(words[0]) ? words[1] : words[0], '');
  if (kind === 'add') {
    const field = fields.find((f) => f.key === key && (f.type === 'number' || f.type === 'money')) ?? fields.find((f) => f.type === 'number' || f.type === 'money');
    return field ? { tap: { kind: 'add', field: field.key }, fields } : { tap: null, fields };
  }
  const date = fields.find((f) => f.key === key && f.type === 'date') ?? fields.find((f) => f.type === 'date');
  if (date) return { tap: { kind: 'date', field: date.key }, fields };
  return fields.length < 4 ? { tap: { kind: 'date', field: 'lastDone' }, fields: [...fields, { key: 'lastDone', label: 'Last done', type: 'date' }] } : { tap: null, fields };
}

export function parseLog(s: Settings, request: string, notes: string[] = []): LogConfig {
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  const noun = cleanText(first(s, 'noun') ?? first(s, 'item'), 24, 'item').toLowerCase();
  let fields = parseFields(s.get('field') ?? [], notes);
  if (!fields.length) notes.push('No fields were set, so each item is just a name.');
  if (!fields.some((f) => f.type === 'text')) fields = [{ key: 'name', label: cap(noun), type: 'text' as FieldType }, ...fields].slice(0, 4);
  const totals = parseTotals(s.get('total') ?? [], fields, notes);
  const tapped = parseTap(first(s, 'tap'), fields);
  fields = tapped.fields;
  const asked = first(s, 'reminder');
  const kept = reminder(asked, name);
  if (asked && !kept && !/^(none|no|off|false)\b/i.test(asked)) notes.push(`Couldn’t set the reminder “${asked}”.`);
  const sortWords = (first(s, 'sort') ?? '').split(/\s+/).filter(Boolean);
  const sortField = fields.find((f) => f.key === identifier(sortWords[0], ''));
  return {
    name, icon: icon(first(s, 'icon'), '📝'), description: cleanText(first(s, 'description'), 140, `Keep track of your ${noun}s`), noun, fields,
    checkbox: flag(first(s, 'checkbox'), false), totals, tap: tapped.tap,
    sort: sortField ? { field: sortField.key, dir: /^(desc|descending|high|newest|latest)/i.test(sortWords[1] ?? '') ? 'desc' : 'asc' } : null,
    share: flag(first(s, 'share'), false), reminder: kept,
  };
}

export const logRecipe: Recipe = {
  id: 'log', title: 'List app',
  hint: 'a list the user adds items to with a small form: checklists, logs, trackers, journals, collections, inventories, budgets',
  summary: 'A list the user adds items to with a small form. Each item has up to 4 fields. It can have tick boxes, totals, a tap action, sorting, a share button and a reminder. Use it for checklists, logs, trackers, journals, collections and inventories.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
noun <what one item is called, e.g. expense>
field <key> <text|longtext|number|money|date|day|choice|rating> <label>   (1 to 4 lines; the first text field is the item's title; date = filled with "now" when added; day = a date the user enters, like a deadline; choice needs options: field status choice Status todo|doing|done; rating = 1 to 5)
checkbox <yes|no>   (tick boxes for to-do style lists)
total <sum|avg|min|max|count> <field> <label>   (up to 3 lines, or none)
tap <date|add> <field> | none   (tapping an item sets a date to now, or adds 1 to a number)
sort <field> <asc|desc> | none
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
total sum amount Total spent
tap none
sort none
share no
reminder none`,
  },
  make: (s, request, notes) => buildLog(parseLog(s, request, notes)),
};
