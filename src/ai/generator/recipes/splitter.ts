import { assemble, ref, tree, type Obj } from './kit';
import { cleanText, first, icon, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CHF'];
export const KINDS = ['item', 'tax', 'service', 'tip', 'subtotal', 'total'];
export type SplitterConfig = { name: string; icon: string; description: string; currency: string };

const sumOf = (kind: string) => ({ $agg: { op: 'sum', of: 'lines', field: 'price', where: { field: 'kind', equals: kind } } });
const math = (...args: unknown[]) => ({ $math: args });
const bill = ref('billTotal');

/** The printed total wins when it is larger than items + tax + service (a missed line); subtotal and tip rows never count. */
const recalc = [
  { op: 'state.set', path: 'billTotal', value: math('+', sumOf('item'), sumOf('tax')) },
  { op: 'state.increment', path: 'billTotal', by: sumOf('service') },
  { op: 'state.set', path: 'billTotal', value: math('max', bill, sumOf('total')) },
];

export function buildSplitter(c: SplitterConfig): Obj {
  const t = tree();
  const photo = t.add('ImageInput', { bind: 'bill', label: 'Receipt photo' });
  const read = t.add('Button', { label: 'Read receipt', onPress: 'readBill', variant: 'primary' });
  const capture = t.add('Card', { title: 'The bill' }, [photo, read]);

  const hint = t.add('Text', { value: 'Check each line. Tap one to fix its price or type. Lines marked ⚠ could not be fully read and stay out of the total until you fix them.', variant: 'muted' });
  const list = t.add('List', { items: 'lines', title: '{{$item.name}}', subtitle: '{{$item.kind}}', trailing: '{{$item.price|fixed2}}', flagField: 'check', deletable: true, onItemPress: 'editLine', emptyText: 'Take a photo of the receipt' });
  const items = t.add('Stat', { label: 'Items total', value: sumOf('item'), format: 'currency', currency: '{{currency}}' });
  const extras = t.add('Stat', { label: 'Tax and service', value: math('+', sumOf('tax'), sumOf('service')), format: 'currency', currency: '{{currency}}' });
  const unread = t.add('Stat', { label: 'Lines to check', value: math('-', { $agg: { op: 'count', of: 'lines' } }, { $agg: { op: 'count', of: 'lines', where: { field: 'check', equals: '' } } }), format: 'number' });
  const again = t.add('Button', { label: 'Set bill total from the lines', onPress: 'recalc', variant: 'secondary' });
  const linesCard = t.add('Card', { title: 'What was read' }, [hint, list, unread, items, extras, again]);

  const money = t.add('Select', { bind: 'currency', label: 'Currency', options: CURRENCIES });
  const total = t.add('NumberInput', { bind: 'billTotal', label: 'Bill total (type it if the photo is wrong)', min: 0, mode: 'field' });
  const tips = [['No tip', 0], ['10% tip', 0.1], ['15% tip', 0.15]].map(([label, rate]) =>
    t.add('Button', { label: label as string, onPress: `tip${Math.round((rate as number) * 100)}`, variant: 'secondary' }));
  const tipRow = t.add('Stack', { direction: 'horizontal', gap: 'sm', wrap: true }, tips);
  const tip = t.add('NumberInput', { bind: 'tip', label: 'Tip', min: 0, mode: 'field' });
  const people = t.add('NumberInput', { bind: 'people', label: 'People', min: 1 });
  const grand = math('+', bill, ref('tip'));
  const sum = t.add('Stat', { label: 'Total with tip', value: grand, format: 'currency', currency: '{{currency}}' });
  const each = t.add('Stat', { label: 'Each person pays', value: math('round', math('/', grand, ref('people')), 2), format: 'currency', currency: '{{currency}}' });
  const note = t.add('Text', { value: 'Split equally between everyone.', variant: 'muted' });
  const share = t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' });
  const split = t.add('Card', { title: 'The split' }, [money, total, tipRow, tip, people, sum, each, note, share]);
  const root = t.add('Stack', { gap: 'md' }, [capture, linesCard, split]);

  const name = t.add('TextInput', { bind: 'editName', label: 'Name' });
  const price = t.add('NumberInput', { bind: 'editPrice', label: 'Price', min: 0, mode: 'field' });
  const kind = t.add('Select', { bind: 'editKind', label: 'Type', options: KINDS });
  const why = t.add('Text', { value: '{{editCheck}}', variant: 'muted' });
  const save = t.add('Button', { label: 'Save line', onPress: 'saveLine', variant: 'primary' });
  const drop = t.add('Button', { label: 'Delete line', onPress: 'deleteLine', variant: 'danger' });
  const lineRoot = t.add('Stack', { gap: 'md' }, [t.add('Card', { title: 'Line details' }, [why, name, price, kind, save, drop])]);

  const aiStep = { op: 'ai.run', image: ref('bill'), into: 'lines',
    prompt: 'Read the receipt. Return every printed row with its name, its numeric price and kind. kind is one of: item (food or drink), tax, service (service charge), tip, subtotal, total.',
    output: { type: 'list', of: { name: 'string', price: 'number', kind: 'string' } }, flag: 'check' };
  const tipAction = (rate: number) => ({ steps: [{ op: 'state.set', path: 'tip', value: math('round', math('*', bill, rate), 2) }] });
  return assemble({ name: c.name, description: c.description, icon: c.icon }, {
    bill: { type: 'image', default: null, persist: false },
    lines: { type: 'list', of: { name: 'string', price: 'number', kind: 'string', check: 'string' }, default: [] },
    billTotal: { type: 'number', default: 0 }, tip: { type: 'number', default: 0 }, people: { type: 'number', default: 2 },
    currency: { type: 'string', default: c.currency },
    editIndex: { type: 'number', default: 0, persist: false }, editName: { type: 'string', default: '', persist: false },
    editPrice: { type: 'number', default: 0, persist: false }, editKind: { type: 'string', default: 'item', persist: false }, editCheck: { type: 'string', default: '', persist: false },
    summary: { type: 'string', default: '', persist: false },
    grandTotal: { type: 'number', default: 0, persist: false }, eachPays: { type: 'number', default: 0, persist: false },
  }, root, t.elements, {
    readBill: { steps: [aiStep, ...recalc, { op: 'toast', message: 'Check the lines and the bill total. Fix any line marked ⚠.' }] },
    recalc: { steps: recalc },
    tip0: tipAction(0), tip10: tipAction(0.1), tip15: tipAction(0.15),
    editLine: { steps: [
      { op: 'state.set', path: 'editIndex', value: ref('$index') }, { op: 'state.set', path: 'editName', value: ref('$item.name') },
      { op: 'state.set', path: 'editPrice', value: ref('$item.price') }, { op: 'state.set', path: 'editKind', value: ref('$item.kind') }, { op: 'state.set', path: 'editCheck', value: ref('$item.check') },
      { op: 'navigate', screen: 'line' }] },
    saveLine: { steps: [{ op: 'state.update', path: 'lines', index: ref('editIndex'), set: { name: ref('editName'), price: ref('editPrice'), kind: ref('editKind'), check: '' } },
      ...recalc, { op: 'navigate', screen: 'main' }] },
    deleteLine: { steps: [{ op: 'confirm', message: 'Delete this line?' }, { op: 'state.remove', path: 'lines', index: ref('editIndex') }, ...recalc, { op: 'navigate', screen: 'main' }] },
    share: { steps: [
      { op: 'state.set', path: 'grandTotal', value: grand },
      { op: 'state.set', path: 'eachPays', value: math('round', math('/', grand, ref('people')), 2) },
      { op: 'state.set', path: 'summary', value: `${c.name}: bill {{billTotal|fixed2}} + tip {{tip|fixed2}} = {{grandTotal|fixed2}} {{currency}}\nPeople: {{people}}, {{eachPays|fixed2}} {{currency}} each` },
      { op: 'share', text: '{{summary}}' }] },
  }, [], [{ id: 'line', title: 'Edit line', root: lineRoot }]);
}

const SYMBOLS: [RegExp, string][] = [[/₹|\b(rupees?|inr)\b/i, 'INR'], [/€|\b(euros?|eur)\b/i, 'EUR'], [/£|\b(pounds?|gbp)\b/i, 'GBP'], [/¥|\b(yen|jpy)\b/i, 'JPY']];

export function parseSplitter(s: Settings, request: string): SplitterConfig {
  return {
    name: cleanText(first(s, 'name'), 40, nameFromRequest(request)), icon: icon(first(s, 'icon'), '🧾'),
    description: cleanText(first(s, 'description'), 140, 'Read a receipt and split the total'),
    currency: SYMBOLS.find(([re]) => re.test(request))?.[1] ?? 'USD',
  };
}

export const splitterRecipe: Recipe = {
  id: 'splitter', version: 1, title: 'Bill splitter',
  hint: 'split a bill or receipt (photo) between people',
  summary: 'The user takes a photo of a bill or receipt, the AI reads the rows, the user fixes them and sets tax, service and tip, and the total is split equally between a number of people.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>`,
  example: {
    request: 'Split a restaurant bill from a photo equally among my friends.',
    reply: `name Bill Splitter
icon 🧾
description Read a receipt and split it between friends`,
  },
  make: (s, request) => buildSplitter(parseSplitter(s, request)),
};
