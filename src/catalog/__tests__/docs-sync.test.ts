import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalog } from '..';

test('AT-15: registry matches P0 headings in both directions', () => {
  const docs = readFileSync(join(__dirname, '../../../docs/COMPONENTS.md'), 'utf8');
  const names = [...docs.matchAll(/^### (\w+) — P0/gm)].map((match) => match[1]);
  expect(Object.keys(catalog).sort()).toEqual(names.sort());
});
test.each(Object.entries(catalog))('%s metadata example and strict props', (name, entry) => {
  expect(entry.meta.name).toBe(name);
  expect(entry.meta.tier).toBe('P0');
  expect(entry.meta.hint.length).toBeGreaterThan(0);
  expect(entry.meta.children).toBe(['Stack', 'Card'].includes(name));
  expect(entry.meta.capabilities).toEqual(name === 'ImageInput' ? ['camera', 'photoLibrary'] : []);
  expect(entry.props.safeParse(entry.meta.example).success).toBe(true);
  expect(entry.props.safeParse({ ...entry.meta.example, unknown: true }).success).toBe(false);
});
test.each([
  ['Stack', {}, { direction: 'vertical', gap: 'md', align: 'stretch', wrap: false }],
  ['Card', {}, {}], ['Divider', {}, {}], ['Text', { value: 'Hi' }, { variant: 'body' }],
  ['Image', { src: { $ref: 'photo' } }, { aspect: 'wide', alt: '' }],
  ['Stat', { label: 'Sum', value: 1 }, { format: 'number' }],
  ['TextInput', { bind: 'notes', label: 'Notes' }, { multiline: false }],
  ['NumberInput', { bind: 'people', label: 'People' }, { step: 1, mode: 'stepper' }],
  ['ImageInput', { bind: 'photo', label: 'Photo' }, { source: 'any' }],
  ['DateInput', { bind: 'due', label: 'Due' }, { mode: 'date' }],
  ['Timer', { seconds: 60, label: 'Tea' }, { notify: true }],
  ['List', { items: 'items', title: 'Item' }, { deletable: false, emptyText: 'Nothing here yet' }],
  ['Button', { label: 'Go', onPress: 'go' }, { variant: 'primary' }],
] as const)('%s documented defaults', (name, input, defaults) => {
  expect(catalog[name].props.parse(input)).toEqual({ ...input, ...defaults });
});
test.each([
  ['Text', {}], ['Image', {}], ['Stat', { label: 'X' }], ['TextInput', { bind: 'x' }],
  ['NumberInput', { label: 'X' }], ['Toggle', { bind: 'x' }], ['Select', { bind: 'x', label: 'X' }],
  ['ImageInput', {}], ['List', { items: 'x' }], ['Button', { label: 'Go' }],
  ['DateInput', { bind: 'x' }], ['DateInput', { bind: 'x', label: 'X', mode: 'time' }], ['Timer', { label: 'X' }], ['Timer', { seconds: 5 }],
  ['Stack', { gap: 'xl' }], ['Stack', { direction: 'diagonal' }], ['Stack', { align: 'baseline' }],
  ['Text', { value: 'Hi', variant: 'hero' }], ['Image', { src: 'file:///x', aspect: 'circle' }],
  ['Stat', { label: 'X', value: 1, format: 'fixed2' }],
  ['NumberInput', { bind: 'x', label: 'X', mode: 'slider' }],
  ['NumberInput', { bind: 'x', label: 'X', mode: 'slider', min: 0 }],
  ['NumberInput', { bind: 'x', label: 'X', mode: 'slider', max: 10 }],
  ['ImageInput', { bind: 'x', label: 'X', source: 'url' }],
  ['Button', { label: 'Go', onPress: 'go', variant: 'ghost' }],
  ['List', { items: 'x', title: 'X', sort: { field: 'name', dir: 'asc', extra: 1 } }],
  ['List', { items: 'x', title: 'X', sort: { field: 'name', dir: 'up' } }],
] as const)('%s rejects invalid props %j', (name, input) => expect(catalog[name].props.safeParse(input).success).toBe(false));
test('Select options bounds and slider bounds', () => {
  for (const n of [1, 2, 12, 13]) expect(catalog.Select.props.safeParse({ bind: 'x', label: 'X', options: Array(n).fill('a') }).success).toBe(n >= 2 && n <= 12);
  expect(catalog.NumberInput.props.safeParse({ bind: 'x', label: 'X', mode: 'slider', min: 0, max: 10 }).success).toBe(true);
});
