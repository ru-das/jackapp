import { assemble, ref, tree, type Obj } from './kit';
import { cleanText, first, flag, icon, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type SplitterConfig = { name: string; icon: string; description: string; share: boolean };

const total = { $agg: { op: 'sum', of: 'lines', field: 'price' } };

export function buildSplitter(c: SplitterConfig): Obj {
  const t = tree();
  const photo = t.add('ImageInput', { bind: 'bill', label: 'Receipt photo' });
  const read = t.add('Button', { label: 'Read receipt', onPress: 'readBill', variant: 'primary' });
  const capture = t.add('Card', { title: 'The bill' }, [photo, read]);
  const list = t.add('List', { items: 'lines', title: '{{$item.name}}', trailing: '{{$item.price|currency}}', deletable: true, emptyText: 'Take a photo of the receipt' });
  const people = t.add('NumberInput', { bind: 'people', label: 'People', min: 1 });
  const sum = t.add('Stat', { label: 'Total', value: total, format: 'currency' });
  const each = t.add('Stat', { label: 'Each person pays', value: { $math: ['round', { $math: ['/', total, ref('people')] }, 2] }, format: 'currency' });
  const share = c.share ? [t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' })] : [];
  const split = t.add('Card', { title: 'The split' }, [list, people, sum, each, ...share]);
  const root = t.add('Stack', { gap: 'md' }, [capture, split]);
  return assemble({ name: c.name, description: c.description, icon: c.icon }, {
    bill: { type: 'image', default: null, persist: false },
    lines: { type: 'list', of: { name: 'string', price: 'number' }, default: [] },
    people: { type: 'number', default: 2 },
  }, root, t.elements, {
    readBill: { steps: [{ op: 'ai.run', prompt: 'Read the receipt. Return each line with its name and numeric price.', image: ref('bill'),
      output: { type: 'list', of: { name: 'string', price: 'number' } }, into: 'lines' }] },
    ...(c.share ? { share: { steps: [{ op: 'share', text: `${c.name}: {{lines|count}} items between {{people}} people` }] } } : {}),
  });
}

export function parseSplitter(s: Settings, request: string): SplitterConfig {
  return {
    name: cleanText(first(s, 'name'), 40, nameFromRequest(request)), icon: icon(first(s, 'icon'), '🧾'),
    description: cleanText(first(s, 'description'), 140, 'Read a receipt and split the total'), share: flag(first(s, 'share'), false),
  };
}

export const splitterRecipe: Recipe = {
  id: 'splitter', title: 'Bill splitter',
  hint: 'split a bill or receipt (photo) between people',
  summary: 'The user takes a photo of a bill or receipt, the AI reads the lines and prices, and the total is split equally between a number of people.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
share <yes|no>`,
  example: {
    request: 'Split a restaurant bill from a photo equally among my friends.',
    reply: `name Bill Splitter
icon 🧾
description Read a receipt and split it between friends
share no`,
  },
  make: (s, request) => buildSplitter(parseSplitter(s, request)),
};
