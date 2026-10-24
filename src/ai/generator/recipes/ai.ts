import { assemble, NOW, ref, tree, type Obj } from './kit';
import { cleanText, first, flag, icon, identifier, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type AiInputKind = 'text' | 'longtext' | 'number' | 'choice' | 'photo';
export type AiInput = { key: string; label: string; kind: AiInputKind; options?: string[] };
export type AiConfig = {
  name: string; icon: string; description: string; inputs: AiInput[]; instruction: string;
  output: 'text' | 'checklist'; button: string; history: boolean; share: boolean;
};

export function buildAi(c: AiConfig): Obj {
  const t = tree();
  const photo = c.inputs.find((i) => i.kind === 'photo');
  const checklist = c.output === 'checklist';
  const state: Obj = {
    ...Object.fromEntries(c.inputs.map((i) => [i.key, i.kind === 'photo' ? { type: 'image', default: null, persist: false }
      : i.kind === 'number' ? { type: 'number', default: 0 }
        : { type: 'string', default: i.kind === 'choice' ? (i.options ?? [''])[0] : '' }])),
    ...(checklist ? { items: { type: 'list', of: { name: 'string', qty: 'string', done: 'boolean' }, default: [] } } : { result: { type: 'string', default: '' } }),
    ...(c.history && !checklist ? { history: { type: 'list', of: { answer: 'string', when: 'date' }, default: [] } } : {}),
  };

  const fields = c.inputs.map((i) => i.kind === 'photo' ? t.add('ImageInput', { bind: i.key, label: i.label })
    : i.kind === 'number' ? t.add('NumberInput', { bind: i.key, label: i.label, mode: 'field' })
      : i.kind === 'choice' ? t.add('Select', { bind: i.key, label: i.label, options: i.options })
        : t.add('TextInput', { bind: i.key, label: i.label, ...(i.kind === 'longtext' ? { multiline: true } : {}) }));
  const run = t.add('Button', { label: c.button, onPress: 'run', variant: 'primary' });
  const inputCard = t.add('Card', { title: 'Ask' }, [...fields, run]);

  const out: string[] = [];
  if (checklist) {
    out.push(t.add('List', { items: 'items', title: '{{$item.name}}', subtitle: '{{$item.qty}}', checkField: 'done', deletable: true, emptyText: 'Your list will appear here' }));
    out.push(t.add('Button', { label: 'Clear done', onPress: 'clearDone', variant: 'secondary' }));
  } else {
    out.push(t.add('Text', { value: '{{result}}', variant: 'body' }));
  }
  if (c.share) out.push(t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' }));
  const resultCard = t.add('Card', { title: checklist ? 'Your list' : 'Answer' }, out);
  const cards = [inputCard, resultCard];
  if (c.history && !checklist) {
    const past = t.add('List', { items: 'history', title: '{{$item.answer}}', subtitle: '{{$item.when|ago}}', deletable: true, emptyText: 'Past answers appear here' });
    cards.push(t.add('Card', { title: 'History' }, [past]));
  }
  const root = t.add('Stack', { gap: 'md' }, cards);

  const prompt = c.instruction.replace(/\[(\w+)\]/g, (m, key: string) => (c.inputs.some((i) => i.key === key) ? `{{${key}}}` : ''));
  const aiStep = {
    op: 'ai.run', prompt, ...(photo ? { image: ref(photo.key) } : {}),
    output: checklist ? { type: 'list', of: { name: 'string', qty: 'string' } } : { type: 'string' },
    into: checklist ? 'items' : 'result', ...(checklist ? { mode: 'replace', defaults: { done: false } } : {}),
  };
  const actions: Obj = {
    run: { steps: [aiStep,
      ...(c.history && !checklist ? [{ op: 'state.append', path: 'history', value: { answer: ref('result'), when: NOW } }] : []),
      ...(checklist ? [{ op: 'toast', message: '{{items|count}} items on your list' }] : [])] },
    ...(checklist ? { clearDone: { steps: [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }] } } : {}),
    ...(c.share ? { share: { steps: [{ op: 'share', text: checklist ? `${c.name}: {{items|count}} items` : '{{result}}' }] } } : {}),
  };
  return assemble({ name: c.name, description: c.description, icon: c.icon }, state, root, t.elements, actions);
}

const KINDS: [RegExp, AiInputKind][] = [
  [/^(photo|image|picture|pic|camera|snap)$/, 'photo'], [/^(number|num|count|int|integer|amount|age|days|minutes)$/, 'number'],
  [/^(choice|select|dropdown|option|options|style|tone|language)$/, 'choice'], [/^(longtext|long|multiline|paragraph|notes?|essay|article|story)$/, 'longtext'],
  [/^(text|string|word|words|topic|name|question|prompt)$/, 'text'],
];

function parseInputs(lines: string[]): AiInput[] {
  const out: AiInput[] = [];
  for (const line of lines) {
    const words = line.replace(/[:=]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length || out.length >= 3) continue;
    const kind = KINDS.find(([re]) => re.test((words[1] ?? '').toLowerCase()))?.[1];
    const rest = words.slice(kind ? 2 : 1);
    const at = rest.findIndex((w) => w.includes('|') || /^options?$/i.test(w));
    const opts = at < 0 ? undefined : [...new Set(rest.slice(at).join(' ').replace(/^options?\s*/i, '').split(/[|,]/).map((o) => cleanText(o, 24)).filter(Boolean))].slice(0, 12);
    const label = cleanText((at < 0 ? rest : rest.slice(0, at)).join(' '), 30) || cleanText(words[0].replace(/([a-z])([A-Z])/g, '$1 $2'), 30);
    const k = kind ?? 'text';
    out.push({
      key: identifier(words[0], 'text', out.map((i) => i.key)), label: label[0].toUpperCase() + label.slice(1), kind: k,
      ...(k === 'choice' ? { options: opts && opts.length >= 2 ? opts : ['Short', 'Medium', 'Long'] } : {}),
    });
  }
  return out;
}

export function parseAi(s: Settings, request: string, notes: string[] = []): AiConfig {
  const wantsPhoto = /\b(photo|photograph\w*|picture|pic|snap|camera|scan)\b/i.test(request);
  let inputs = parseInputs(s.get('input') ?? []);
  // Only one photo can go to the model per run.
  inputs = inputs.filter((i, n) => i.kind !== 'photo' || inputs.findIndex((x) => x.kind === 'photo') === n);
  if (!inputs.length) inputs = [wantsPhoto ? { key: 'photo', label: 'Photo', kind: 'photo' } : { key: 'text', label: 'Your text', kind: 'longtext' }];
  const wantsList = /\b(list|checklist|ideas|items|groceries|names)\b/i.test(request);
  const asked = (first(s, 'output') ?? '').toLowerCase();
  const output = asked.startsWith('check') || asked.startsWith('list') ? 'checklist' : asked.startsWith('text') || asked.startsWith('answer') ? 'text' : wantsList ? 'checklist' : 'text';
  const fallbackKey = inputs[0].key;
  const instruction = cleanText(first(s, 'instruction')?.replace(/[[\]]/g, (c) => (c === '[' ? '\u0001' : '\u0002')), 300)
    .replace(/\u0001(\w+)\u0002/g, '[$1]').replace(/[\u0001\u0002]/g, '')
    || (inputs[0].kind === 'photo' ? 'Describe what you see and list what is useful.' : `Help with this: [${fallbackKey}]`);
  if (!first(s, 'instruction') || !cleanText(first(s, 'instruction'), 300)) notes.push('No instruction was set, so the AI gets a general one.');
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  return {
    name, icon: icon(first(s, 'icon'), '✨'), description: cleanText(first(s, 'description'), 140, `${name}: ask the AI`), inputs, instruction, output,
    button: cleanText(first(s, 'button'), 24, output === 'checklist' ? 'Make my list' : 'Ask'), history: flag(first(s, 'history'), false), share: flag(first(s, 'share'), false),
  };
}

export const aiRecipe: Recipe = {
  id: 'ai', title: 'AI helper',
  hint: 'the AI writes an answer or a checklist from text or a photo: generators, summaries, translations, explanations, identification',
  summary: 'The user gives some text, numbers or a photo, and the AI writes an answer or a checklist: generators, summarisers, rewriters, translators, explainers, identifiers, planners.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
input <key> <text|longtext|number|choice|photo> <label>   (1 to 3 lines; choice needs options: input tone choice Tone formal|friendly)
instruction <what the AI should do, one or two sentences; write [key] where an input goes>
output <text|checklist>   (text = a written answer, checklist = items to tick off)
button <button label>
history <yes|no>   (keep past answers; text output only)
share <yes|no>`,
  example: {
    request: 'Make me a shopping list from a photo of my fridge, with boxes to tick when bought.',
    reply: `name Fridge Snap
icon 🧊
description Photo of your fridge to grocery list
input photo photo Fridge photo
input note text Anything to add?
instruction List common groceries that look missing or nearly finished. Extra notes from the user: [note]
output checklist
button Make my list
history no
share no`,
  },
  make: (s, request, notes) => buildAi(parseAi(s, request, notes)),
};
