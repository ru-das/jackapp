import { h1, h2, invalidFixtures, validFixtures } from '../fixtures';
import { SpecSchema } from '../schema';
import type { Spec, Value } from '../types';
import { validate } from '../validate';

export const minimal = (): Spec => SpecSchema.parse({ specVersion: '0.1', meta: { name: 'Test', description: '', icon: '🧊' },
  state: {}, screens: [{ id: 'main', title: 'Test', root: 'root' }],
  elements: { root: { type: 'Stack', props: {}, children: [] } }, actions: {} });
function stat(value: unknown, format = 'number') {
  return { ...minimal(), elements: { root: { type: 'Stat', props: { label: 'Value', value, format } } } };
}
function withSteps(steps: unknown[], state: unknown = {}) {
  return { ...minimal(), state, actions: { test: { steps } } };
}
const expectError = (input: unknown, code: string, path: string) => {
  expect(validate(input)).toEqual(expect.arrayContaining([expect.objectContaining({ code, path, hint: expect.any(String) })]));
};

test.each(Object.entries(validFixtures))('AT-01 hero %s', (_, input) => {
  expect(validate(input)).toEqual([]);
  expect(validate(JSON.stringify(input))).toEqual([]);
});
test.each(Object.entries(invalidFixtures))('AT-01 invalid %s', (_, fixture) => {
  expectError(fixture.input, fixture.expected.code, fixture.expected.path);
});
test.each([null, [], 3, true])('non-object input %j', (input) => expectError(input, 'SHAPE', ''));
test.each([undefined, NaN, Infinity, () => 1, new Date(), { a: undefined }])('non-JSON input', (input) => {
  expect(validate(input)[0].code).toBe('SHAPE');
});
test('cyclic JS input is rejected safely', () => {
  const input: { self?: unknown } = {}; input.self = input;
  expectError(input, 'SHAPE', 'self');
});
test('unknown keys have precise paths', () => {
  expectError({ ...minimal(), extra: 1 }, 'SHAPE', 'extra');
  expectError({ ...minimal(), meta: { ...minimal().meta, extra: 1 } }, 'SHAPE', 'meta.extra');
  expectError({ ...h1, elements: { ...h1.elements, list: { type: 'List', props: { ...h1.elements.list.props,
    sort: { field: 'name', dir: 'asc', extra: 1 } } } } }, 'BAD_PROP', 'elements.list.props.sort.extra');
  expectError(withSteps([{ op: 'toast', message: 'Hi', extra: 1 }]), 'BAD_ACTION', 'actions.test.steps[0].extra');
});
test.each(['DateInput', 'Timer', 'Chart'])('P1 %s is deferred', (type) => expectError({ ...minimal(),
  elements: { root: { type, props: {} } } }, 'UNKNOWN_COMPONENT', 'elements.root.type'));
test('all missing reference kinds', () => {
  const s = minimal(); s.elements.root.children = ['absent'];
  s.elements.button = { type: 'Button', props: { label: 'Go', onPress: 'absent' } };
  s.actions.a = { steps: [{ op: 'navigate', screen: 'absent' }, { op: 'state.reset', path: 'absent' }] };
  for (const [code, path] of [
    ['MISSING_REF', 'elements.root.children[0]'], ['MISSING_REF', 'elements.button.props.onPress'],
    ['MISSING_REF', 'actions.a.steps[0].screen'], ['UNDECLARED_STATE', 'actions.a.steps[1].path'],
  ]) expectError(s, code, path);
});
test('duplicate screen and trigger ids, shared roots', () => {
  const s = structuredClone(h2); s.screens.push(s.screens[0]); s.triggers.push(s.triggers[0]);
  expectError(s, 'TREE', 'screens[1].id'); expectError(s, 'TREE', 'triggers[1].id'); expectError(s, 'TREE', 'elements.root');
});
test('disconnected cycle and duplicate slots are detected', () => {
  const s = minimal();
  s.elements.a = { type: 'Stack', props: {}, children: ['b'] };
  s.elements.b = { type: 'Stack', props: {}, children: ['a'] };
  expectError(s, 'TREE', 'elements.a');
  expect(validate(s).some((e) => /cycle/.test(e.message))).toBe(true);
});
test.each([
  ['TextInput', 'number'], ['NumberInput', 'string'], ['Toggle', 'number'], ['Select', 'boolean'], ['ImageInput', 'string'],
] as const)('%s bind requires correct type', (type, stateType) => {
  const input = { ...minimal(), state: { x: { type: stateType, default: stateType === 'number' ? 0 : stateType === 'boolean' ? false : '' } },
    elements: { root: { type, props: { bind: 'x', label: 'X', ...(type === 'Select' ? { options: ['A', 'B'] } : {}) } } } };
  expectError(input, 'TYPE_MISMATCH', 'elements.root.props.bind');
});
test('List source, item fields, sort and checkbox types', () => {
  const s = structuredClone(h1); s.elements.list.props.checkField = 'name';
  expectError(s, 'TYPE_MISMATCH', 'elements.list.props.checkField');
  const input = { ...s, elements: { ...s.elements, list: { type: 'List', props: { ...s.elements.list.props,
    title: '{{$item.missing}}', sort: { field: 'missing', dir: 'asc' } } } } };
  expectError(input, 'BAD_VALUE', 'elements.list.props.title'); expectError(input, 'BAD_VALUE', 'elements.list.props.sort.field');
});
test.each([
  [{ $ref: 'missing' }, 'UNDECLARED_STATE', 'elements.root.props.value'],
  [{ $ref: '$index' }, 'BAD_VALUE', 'elements.root.props.value'],
  [{ $ref: 'items.0.name' }, 'BAD_VALUE', 'elements.root.props.value'],
  [{ $math: ['+', '2', 3] }, 'TYPE_MISMATCH', 'elements.root.props.value.$math[1]'],
  [{ $math: ['round', 3, 0.5] }, 'BAD_VALUE', 'elements.root.props.value.$math[2]'],
  [{ $math: ['mod', 2, 3] }, 'BAD_VALUE', 'elements.root.props.value'],
])('Value checks %j', (value, code, path) => expectError(stat(value), code as string, path as string));
test.each([
  { $math: ['days', '2026-10-01', { $now: true }] }, { $math: ['pow', { $math: ['+', 1, 2] }, 2] }, { $math: ['min', 3, 4] }, { $math: ['max', 3, { $ref: 'people' }] },
  { $math: ['days', { $ref: 'since' }, { $now: true }] },
])('new math operators validate: %j', (value) => {
  const s = { ...stat(value as Value), state: { people: { type: 'number', default: 2 }, since: { type: 'date', default: null } } };
  expect(validate(s)).toEqual([]);
});
test.each([
  [{ $math: ['days', 3, '2026-10-01'] }, 'TYPE_MISMATCH', 'elements.root.props.value.$math[1]'],
  [{ $math: ['days', '2026-10-01', 'tomorrow'] }, 'TYPE_MISMATCH', 'elements.root.props.value.$math[2]'],
  [{ $math: ['+', '2026-10-01', 1] }, 'TYPE_MISMATCH', 'elements.root.props.value.$math[1]'],
  [{ $math: ['pow', '2', 2] }, 'TYPE_MISMATCH', 'elements.root.props.value.$math[1]'],
])('new math operators check operand types %j', (value, code, path) => expectError(stat(value as Value), code as string, path as string));
test('aggregates verify list, numeric field and typed filters', () => {
  const s = { ...stat({ $agg: { op: 'sum', of: 'items', field: 'name', where: { field: 'done', equals: 'false' } } }), state: h1.state };
  expectError(s, 'TYPE_MISMATCH', 'elements.root.props.value.$agg.field');
  expectError(s, 'TYPE_MISMATCH', 'elements.root.props.value.$agg.where.equals');
  expectError({ ...stat({ $agg: { op: 'count', of: 'notes' } }), state: h1.state }, 'TYPE_MISMATCH', 'elements.root.props.value.$agg.of');
  expectError({ ...stat({ $agg: { op: 'sum', of: 'items', field: 'absent' } }), state: h1.state }, 'BAD_VALUE', 'elements.root.props.value.$agg.field');
});
test.each([
  ['{{notes|count}}', 'TYPE_MISMATCH'], ['{{items}}', 'TYPE_MISMATCH'], ['{{notes|date}}', 'TYPE_MISMATCH'],
  ['{{notes|wat}}', 'BAD_VALUE'], ['{{notes|upper|lower}}', 'BAD_VALUE'], ['{{}}', 'BAD_VALUE'], ['{{notes.0}}', 'BAD_VALUE'],
  ['{{$item.name}}', 'BAD_VALUE'], ['{{missing}}', 'UNDECLARED_STATE'],
])('template %s', (value, code) => expectError({ ...stat(value, 'text'), state: h1.state }, code, 'elements.root.props.value'));
test('escaped and unmatched templates stay literal; labels are inspected only where documented', () => {
  expect(validate(stat('\\{{missing}} {{unfinished', 'text'))).toEqual([]);
  expect(validate({ ...minimal(), state: { notes: h1.state.notes }, elements: { root: { type: 'TextInput',
    props: { bind: 'notes', label: '{{missing}}', placeholder: '{{missing}}' } } } })).toEqual([]);
});
test('image sources and Stat formats require compatible types', () => {
  const image = (src: unknown) => ({ ...minimal(), elements: { root: { type: 'Image', props: { src } } } });
  for (const src of ['file:///photo.jpg', 'data:image/png;base64,x']) expect(validate(image(src))).toEqual([]);
  expectError(image('https://example.com/x'), 'TYPE_MISMATCH', 'elements.root.props.src');
  expectError(image(1), 'TYPE_MISMATCH', 'elements.root.props.src');
  expect(validate({ ...image({ $ref: 'photo' }), state: h1.state })).toEqual([]);
  expect(validate(stat('2026-10-22', 'date'))).toEqual([]);
  expectError(stat('yesterday', 'date'), 'TYPE_MISMATCH', 'elements.root.props.value');
  expectError(stat('2'), 'TYPE_MISMATCH', 'elements.root.props.value');
});
test('all action operations have a valid representative', () => {
  const s = { n: { type: 'number', default: 0 }, done: { type: 'boolean', default: false }, notes: h1.state.notes, items: h1.state.items };
  const steps = [
    { op: 'state.set', path: 'notes', value: 'Hello' }, { op: 'state.append', path: 'items', value: { name: 'Milk', qty: '2', done: false } },
    { op: 'state.update', path: 'items', index: 0, set: { qty: '3' } }, { op: 'state.remove', path: 'items', index: 0 },
    { op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }, { op: 'state.toggle', path: 'done' },
    { op: 'state.increment', path: 'n' }, { op: 'state.reset', path: 'items' }, { op: 'navigate', screen: 'main' },
    { op: 'ai.run', prompt: 'Return a number', output: { type: 'number' }, into: 'n' }, { op: 'confirm', message: 'Sure?' },
    { op: 'toast', message: '{{notes}}' }, { op: 'notify', title: 'Hi', body: '{{notes}}' }, { op: 'share', text: '{{notes}}' },
  ];
  for (const step of steps) expect(validate(withSteps([step], s))).toEqual([]);
});
test('append needs all fields, update allows partial, and unknown fields fail', () => {
  const state = { items: h1.state.items };
  expectError(withSteps([{ op: 'state.append', path: 'items', value: { name: 'Milk' } }], state), 'BAD_ACTION', 'actions.test.steps[0].value.qty');
  expect(validate(withSteps([{ op: 'state.update', path: 'items', index: 0, set: { qty: '2' } }], state))).toEqual([]);
  expectError(withSteps([{ op: 'state.update', path: 'items', index: 0, set: { absent: 1 } }], state), 'BAD_VALUE', 'actions.test.steps[0].set.absent');
  expectError(withSteps([{ op: 'state.append', path: 'items', value: { name: 'Milk', qty: 2, done: false } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].value.qty');
});
test('whole-list assignment requires identical field schemas', () => {
  const state = { a: h1.state.items, b: { type: 'list', of: { name: 'string' }, default: [] } };
  expectError(withSteps([{ op: 'state.set', path: 'a', value: { $ref: 'b' } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].value');
  expect(validate(withSteps([{ op: 'state.set', path: 'a', value: { $ref: 'b' } }], { ...state, b: h1.state.items }))).toEqual([]);
});
test.each([-1, 1.5])('literal index %s fails', (index) => {
  for (const op of ['state.update', 'state.remove']) expectError(withSteps([{ op, path: 'items', index,
    ...(op === 'state.update' ? { set: {} } : {}) }], { items: h1.state.items }), 'BAD_VALUE', 'actions.test.steps[0].index');
});
test('mixed ordinary/item callers and unused item actions are rejected', () => {
  const s = structuredClone(h2);
  s.elements.addBtn.props.onPress = 'waterOne';
  expectError(s, 'BAD_VALUE', 'actions.waterOne.steps[0].index');
  const unused = structuredClone(h2); delete (unused.elements.plantsList.props as { onItemPress?: string }).onItemPress;
  expectError(unused, 'BAD_VALUE', 'actions.waterOne.steps[0].index');
});
test('every calling List must satisfy item schema requirements', () => {
  const s = minimal();
  s.state.a = { type: 'list', of: { price: 'number' }, default: [], persist: true };
  s.state.b = { type: 'list', of: { price: 'string' }, default: [], persist: true };
  s.state.n = { type: 'number', default: 0, persist: true };
  s.elements.root.children = ['a', 'b'];
  for (const id of ['a', 'b']) s.elements[id] = { type: 'List', props: { items: id, title: 'Item', onItemPress: 'sum' } };
  s.actions.sum = { steps: [{ op: 'state.increment', path: 'n', by: { $ref: '$item.price' } }] };
  expectError(s, 'TYPE_MISMATCH', 'actions.sum.steps[0].by');
  s.state.b = { ...s.state.b, of: { name: 'string' } };
  expectError(s, 'BAD_VALUE', 'actions.sum.steps[0].by');
});
test('AI output subset, matching field types, defaults, mode and image', () => {
  const step = { op: 'ai.run', prompt: 'Hi', output: { type: 'list', of: { name: 'string' } }, into: 'items' };
  const state = { items: h1.state.items, notes: h1.state.notes };
  expect(validate(withSteps([{ ...step, defaults: { done: false } }], state))).toEqual([]);
  expectError(withSteps([{ ...step, output: { type: 'list', of: { unknown: 'string' } } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].output.of.unknown');
  expectError(withSteps([{ ...step, output: { type: 'list', of: { name: 'number' } } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].output.of.name');
  expectError(withSteps([{ ...step, defaults: { done: 'false' } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].defaults.done');
  expectError(withSteps([{ ...step, defaults: { unknown: 1 } }], state), 'BAD_VALUE', 'actions.test.steps[0].defaults.unknown');
  expectError(withSteps([{ ...step, image: { $ref: 'notes' } }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].image');
  expectError(withSteps([{ ...step, output: { type: 'string' }, into: 'notes', mode: 'append' }], state), 'BAD_ACTION', 'actions.test.steps[0].mode');
  expectError(withSteps([{ ...step, output: { type: 'string' }, into: 'notes', defaults: {} }], state), 'BAD_ACTION', 'actions.test.steps[0].defaults');
});
test('multiple independent errors remain precise, unique, repeatable and immutable', () => {
  const s = minimal(); s.state.n = { type: 'number', default: 1, persist: true };
  s.elements.root = { type: 'TextInput', props: { bind: 'n', label: 'Number' } };
  s.actions.a = { steps: [{ op: 'state.reset', path: 'absent' }] };
  const before = JSON.stringify(s);
  const errors = validate(s);
  expect(errors).toHaveLength(2); expect(validate(s)).toEqual(errors);
  expect(JSON.stringify(s)).toBe(before);
  expect(new Set(errors.map((e) => `${e.code}:${e.path}`)).size).toBe(errors.length);
  Object.freeze(s); expect(validate(s)).toEqual(errors);
});
test('malformed declarations do not cause dependent reference/type errors', () => {
  const s = { ...minimal(), meta: { name: '', description: '', icon: '🧊' }, state: { x: { type: 'number', default: 'bad' } },
    elements: { root: { type: 'NumberInput', props: { bind: 'x', label: 'X' } } }, actions: { test: { steps: [{ op: 'navigate', screen: 'missing' }] } } };
  expectError(s, 'SHAPE', 'state.x.default'); expectError(s, 'MISSING_REF', 'actions.test.steps[0].screen');
  expect(validate(s).some((e) => ['UNDECLARED_STATE', 'TYPE_MISMATCH'].includes(e.code))).toBe(false);
});
// A boundary test below also ensures this type remains exported for runtime consumers.
const math = (depth: number): Value => depth ? { $math: ['+', math(depth - 1), 1] } : 1;
test('math nesting boundary is three nodes', () => {
  expect(validate(stat(math(3)))).toEqual([]);
  expectError(stat(math(4)), 'BAD_VALUE', 'elements.root.props.value');
  expectError(stat(math(60)), 'BAD_VALUE', 'elements.root.props.value');
});
test.each([
  [{ op: 'state.set', path: 'n', value: true }, 'actions.test.steps[0].value'],
  [{ op: 'state.increment', path: 'notes', by: 1 }, 'actions.test.steps[0].path'],
  [{ op: 'state.increment', path: 'n', by: '1' }, 'actions.test.steps[0].by'],
  [{ op: 'state.toggle', path: 'n' }, 'actions.test.steps[0].path'],
  [{ op: 'state.append', path: 'n', value: {} }, 'actions.test.steps[0].path'],
  [{ op: 'state.update', path: 'n', index: 0, set: {} }, 'actions.test.steps[0].path'],
  [{ op: 'state.remove', path: 'n', index: 0 }, 'actions.test.steps[0].path'],
  [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: 1 } }, 'actions.test.steps[0].where.equals'],
] as const)('action target/value compatibility %j', (step, path) => {
  expectError(withSteps([step], { ...h1.state, n: { type: 'number', default: 0 } }), 'TYPE_MISMATCH', path);
});
test('literal date/image assignments use their declared positions', () => {
  const state = { when: { type: 'date', default: null }, photo: h1.state.photo };
  expect(validate(withSteps([{ op: 'state.set', path: 'when', value: '2026-10-22T12:00:00Z' },
    { op: 'state.set', path: 'photo', value: 'file:///photo.jpg' }], state))).toEqual([]);
  expectError(withSteps([{ op: 'state.set', path: 'when', value: 'bad' }], state), 'TYPE_MISMATCH', 'actions.test.steps[0].value');
});
test('malformed action Values map to BAD_VALUE before BAD_ACTION/SHAPE', () => {
  for (const [step, path] of [
    [{ op: 'state.set', path: 'notes', value: { $ref: 'a.0' } }, 'value.$ref'],
    [{ op: 'state.update', path: 'items', index: { $math: ['mod', 2, 3] }, set: {} }, 'index'],
    [{ op: 'state.increment', path: 'n', by: { $now: false } }, 'by'],
  ] as const) expectError(withSteps([step], h1.state), 'BAD_VALUE', `actions.test.steps[0].${path}`);
});
test('valid formatters and aggregate variants', () => {
  const state = { ...h1.state, n: { type: 'number', default: 0 }, when: { type: 'date', default: null } };
  const text = '{{notes|upper}} {{notes|lower}} {{items|count}} {{n|currency}} {{n|fixed2}} {{when|date}} {{when|time}} {{when|ago}}';
  expect(validate({ ...stat(text, 'text'), state })).toEqual([]);
  for (const op of ['sum', 'avg', 'min', 'max', 'count']) expect(validate({ ...stat({ $agg: {
    op, of: 'items', ...(op === 'count' ? {} : { field: 'n' }), where: { field: 'when', equals: null },
  } }), state: { items: { type: 'list', of: { n: 'number', when: 'date' }, default: [] } } })).toEqual([]);
});
test('valid multi-screen disjoint trees and dynamic index/digits', () => {
  const s = minimal(); s.elements.other = { type: 'Divider', props: {} };
  s.screens.push({ id: 'other', title: 'Other', root: 'other' });
  s.state.n = { type: 'number', default: 0, persist: true };
  s.state.items = SpecSchema.parse(h1).state.items;
  s.actions.test = { steps: [{ op: 'navigate', screen: 'other' },
    { op: 'state.update', path: 'items', index: { $ref: 'n' }, set: { qty: '1' } },
    { op: 'state.set', path: 'n', value: { $math: ['round', 1.123, { $ref: 'n' }] } }] };
  expect(validate(s)).toEqual([]);
});
test('own-property checks reject inherited state/action/screen names', () => {
  expectError(stat({ $ref: 'constructor' }), 'UNDECLARED_STATE', 'elements.root.props.value');
  expectError(withSteps([{ op: 'navigate', screen: 'toString' }]), 'MISSING_REF', 'actions.test.steps[0].screen');
});
test('a malformed trigger does not shift paths for valid sibling triggers', () => {
  const trigger = h2.triggers[0];
  const input = { ...minimal(), triggers: [{ ...trigger, schedule: { kind: 'bad' } },
    { ...trigger, id: 'second', notify: { title: '{{missing}}', body: '' } }] };
  expectError(input, 'UNDECLARED_STATE', 'triggers[1].notify.title');
  expect(validate(input).some((e) => e.code === 'UNDECLARED_STATE' && e.path === 'triggers[0].notify.title')).toBe(false);
});
test('unknown nested Value properties retain precise paths', () => {
  expectError(stat({ $ref: 'notes', extra: 1 }), 'BAD_VALUE', 'elements.root.props.value.extra');
  expectError({ ...stat({ $agg: { op: 'count', of: 'items', extra: 1 } }), state: h1.state },
    'BAD_VALUE', 'elements.root.props.value.$agg.extra');
});
test('unknown properties with punctuation use unambiguous bracket paths', () => {
  expectError({ ...minimal(), 'unexpected.key': 1 }, 'SHAPE', '["unexpected.key"]');
  expectError({ ...minimal(), state: { items: { type: 'list', of: { name: 'string' }, default: [{ name: 'X', extra: true }] } } },
    'SHAPE', 'state.items.default[0].extra');
});
test('a malformed action step does not hide independent errors or shift indices', () => {
  const s = withSteps([{ op: 'unknown' }, { op: 'state.reset', path: 'missing' }, { op: 'navigate', screen: 'missing' }]);
  expectError(s, 'BAD_ACTION', 'actions.test.steps[0].op');
  expectError(s, 'UNDECLARED_STATE', 'actions.test.steps[1].path');
  expectError(s, 'MISSING_REF', 'actions.test.steps[2].screen');
});
