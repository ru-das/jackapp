import { assemble, ref, tree, type Obj } from './kit';
import { cleanText, first, flag, icon, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type AiListConfig = { name: string; icon: string; description: string; source: 'photo' | 'text'; instruction: string; share: boolean };

export function buildAiList(c: AiListConfig): Obj {
  const t = tree();
  const photo = c.source === 'photo';
  const inputs = photo
    ? [t.add('ImageInput', { bind: 'photo', label: 'Photo' }), t.add('TextInput', { bind: 'note', label: 'Anything to add?' })]
    : [t.add('TextInput', { bind: 'note', label: 'What do you have?', multiline: true })];
  const make = t.add('Button', { label: 'Make my list', onPress: 'make', variant: 'primary' });
  const input = t.add('Card', { title: photo ? 'Snap it' : 'Tell me' }, [...inputs, make]);
  const list = t.add('List', { items: 'items', title: '{{$item.name}}', subtitle: '{{$item.qty}}', checkField: 'done', deletable: true, emptyText: 'Your list will appear here' });
  const clear = t.add('Button', { label: 'Clear done', onPress: 'clearDone', variant: 'secondary' });
  const share = c.share ? [t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' })] : [];
  const output = t.add('Card', { title: 'Your list' }, [list, clear, ...share]);
  const root = t.add('Stack', { gap: 'md' }, [input, output]);
  const prompt = `${c.instruction} Short names. ${photo ? 'Extra notes from the user' : 'The user wrote'}: {{note}}`;
  return assemble({ name: c.name, description: c.description, icon: c.icon }, {
    ...(photo ? { photo: { type: 'image', default: null, persist: false } } : {}),
    note: { type: 'string', default: '' },
    items: { type: 'list', of: { name: 'string', qty: 'string', done: 'boolean' }, default: [] },
  }, root, t.elements, {
    make: { steps: [
      { op: 'ai.run', prompt, ...(photo ? { image: ref('photo') } : {}), output: { type: 'list', of: { name: 'string', qty: 'string' } },
        into: 'items', mode: 'replace', defaults: { done: false } },
      { op: 'toast', message: '{{items|count}} items on your list' },
    ] },
    clearDone: { steps: [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }] },
    ...(c.share ? { share: { steps: [{ op: 'share', text: `${c.name}: {{items|count}} items` }] } } : {}),
  });
}

export function parseAiList(s: Settings, request: string): AiListConfig {
  const asked = (first(s, 'source') ?? '').toLowerCase();
  const source = asked.startsWith('text') || (!asked && !/photo|picture|snap|camera|scan/i.test(request)) ? 'text' : 'photo';
  return {
    name: cleanText(first(s, 'name'), 40, nameFromRequest(request)), icon: icon(first(s, 'icon'), '📋'),
    description: cleanText(first(s, 'description'), 140, 'Let the AI write a checklist for you'), source,
    instruction: cleanText(first(s, 'instruction'), 300, source === 'photo' ? 'You see a photo. List the items that look missing or nearly finished.' : 'Suggest a list that fits what the user wrote.'),
    share: flag(first(s, 'share'), false),
  };
}

export const aiListRecipe: Recipe = {
  id: 'ai-list', title: 'AI list',
  summary: 'The user gives a photo or some text, the AI writes a checklist from it, and the user ticks items off.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
source <photo|text>   (photo = the user takes a picture, text = the user types)
instruction <what the AI should list, one sentence>
share <yes|no>`,
  example: {
    request: 'Make me a shopping list from a photo of my fridge, with boxes to tick when bought.',
    reply: `name Fridge Snap
icon 🧊
description Photo of your fridge to grocery list
source photo
instruction List common groceries that look missing or nearly finished.
share no`,
  },
  make: (s, request) => buildAiList(parseAiList(s, request)),
};
