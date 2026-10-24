import {
  ActionSchema, ActionStepSchema, ComponentNameSchema, ElementSchema, IdentifierSchema,
  MetaSchema, OutputSchema, ScheduleSchema, SpecSchema, StateDeclSchema, TriggerSchema, ValueSchema,
} from '../schema';

const meta = { name: 'Test', description: '', icon: '🧊' };
const spec = {
  specVersion: '0.1', meta, state: {}, screens: [{ id: 'main', title: 'Test', root: 'root' }],
  elements: { root: { type: 'Stack', props: {}, children: [] } }, actions: {},
};
const entries = (n: number, value: unknown) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`a${i}`, value]));
const step = { op: 'toast', message: 'Hello' };

describe('structural contract', () => {
  test('minimal spec and optional generator metadata', () => {
    expect(SpecSchema.parse(spec)).toEqual(spec);
    expect(MetaSchema.parse({ ...meta, sourcePrompt: 'test', generatedBy: { provider: 'local', model: 'gemma' } })).toBeDefined();
  });
  test.each(['a', 'camelCase12', `a${'Z'.repeat(31)}`])('identifier accepts %s', (id) => expect(IdentifierSchema.safeParse(id).success).toBe(true));
  test.each(['', 'A', 'a_b', 'a.b', '$index', `a${'a'.repeat(32)}`, 'a\n'])('identifier rejects %s', (id) => expect(IdentifierSchema.safeParse(id).success).toBe(false));
  test.each(['🧊', '👨‍👩‍👧‍👦', '🇮🇳', '👍🏽', '1️⃣'])('single emoji %s', (icon) => expect(MetaSchema.safeParse({ ...meta, icon }).success).toBe(true));
  test.each([{ name: '' }, { name: 'a'.repeat(41) }, { description: 'a'.repeat(141) }, { icon: 'ab' }, { icon: '🧊🧊' }])('metadata limits %j', (change) => {
    expect(MetaSchema.safeParse({ ...meta, ...change }).success).toBe(false);
  });
  test('metadata boundaries', () => expect(MetaSchema.safeParse({ ...meta, name: 'a'.repeat(40), description: 'a'.repeat(140) }).success).toBe(true));
  test.each([
    ['string', 'hi'], ['number', 2], ['boolean', false], ['date', null], ['date', '2026-10-22'],
    ['date', '2026-10-22T12:00:00+05:30'], ['image', null], ['image', 'file:///photo.jpg'], ['image', 'data:image/jpeg;base64,abc'],
  ])('state %s default %j', (type, value) => {
    expect(StateDeclSchema.parse({ type, default: value })).toEqual({ type, default: value, persist: true });
  });
  test.each([
    { type: 'string', default: null }, { type: 'number', default: '2' }, { type: 'number', default: Infinity },
    { type: 'boolean', default: 0 }, { type: 'date', default: 'yesterday' }, { type: 'image', default: 'https://example.com' },
    { type: 'string' }, { type: 'object', default: {} },
    { type: 'list', of: { a: 'list' } },
    { type: 'list', of: { a: 'number' }, default: [{ a: '2' }] },
    { type: 'list', of: { a: 'number' }, default: [{}] },
    { type: 'list', of: { a: 'number' }, default: [{ a: 2, extra: true }] },
    { type: 'list', of: { a: 'date' }, default: [{ a: 'bad date' }] },
    { type: 'list', of: { a: 'string' }, default: [{ a: null }] },
  ])('rejects state %j', (decl) => expect(StateDeclSchema.safeParse(decl).success).toBe(false));
  test('list defaults and strict typed rows', () => {
    expect(StateDeclSchema.parse({ type: 'list', of: {} })).toEqual({ type: 'list', of: {}, default: [], persist: true });
    expect(StateDeclSchema.safeParse({ type: 'list', of: { a: 'string', b: 'number', c: 'boolean', d: 'date' },
      default: [{ a: '', b: 1, c: true, d: null }], persist: false }).success).toBe(true);
  });
  test.each(['string', 'number', 'boolean', 'date', 'image'])('AI scalar output %s', (type) => expect(OutputSchema.safeParse({ type }).success).toBe(true));
  test('list fields limit', () => {
    expect(OutputSchema.safeParse({ type: 'list', of: entries(8, 'string') }).success).toBe(true);
    expect(OutputSchema.safeParse({ type: 'list', of: entries(9, 'string') }).success).toBe(false);
  });
  test.each([
    'Hello', 3, true, { $ref: 'items' }, { $ref: '$item.name' }, { $ref: '$index' }, { $now: true },
    ...['count', 'sum', 'avg', 'min', 'max'].map((op) => ({ $agg: { op, of: 'items', ...(op === 'count' ? {} : { field: 'price' }), where: { field: 'done', equals: false } } })),
    ...['+', '-', '*', '/', 'round', 'pow', 'min', 'max', 'days'].map((op) => ({ $math: [op, 3, 2] })),
  ])('Value accepts %j', (value) => expect(ValueSchema.safeParse(value).success).toBe(true));
  test.each([
    null, [], {}, { $ref: 'items.0.name' }, { $ref: '$item.name.foo' }, { $ref: 'a', extra: 1 },
    { $now: false }, { $now: true, extra: 1 }, { $agg: { op: 'sum', of: 'items' } },
    { $agg: { op: 'median', of: 'items', field: 'price' } }, { $agg: { op: 'count', of: 'items', where: { field: 'done', equals: false, extra: 1 } } },
    { $math: ['mod', 2, 3] }, { $math: ['+', 1] }, { $math: ['+', 1, 2, 3] },
  ])('Value rejects %j', (value) => expect(ValueSchema.safeParse(value).success).toBe(false));
  test('math depth boundary', () => {
    const a = { $math: ['+', 1, 2] };
    const b = { $math: ['+', a, a] };
    const c = { $math: ['+', b, b] };
    expect(ValueSchema.safeParse(c).success).toBe(true);
    expect(ValueSchema.safeParse({ $math: ['+', c, 1] }).success).toBe(false);
  });
  test.each(ComponentNameSchema.options)('catalog %s', (type) => {
    expect(ElementSchema.safeParse({ type, props: { arbitrary: { json: [null, true] } } }).success).toBe(true);
    expect(ElementSchema.safeParse({ type, props: {}, children: [] }).success).toBe(['Stack', 'Card'].includes(type));
  });
  test.each([
    { type: 'Unknown', props: {} }, { type: 'Text', props: { callback: () => 1 } },
    { type: 'Text', props: { missing: undefined } }, { type: 'Text', props: {}, unknown: 1 },
  ])('element rejects %j', (element) => expect(ElementSchema.safeParse(element).success).toBe(false));
  const steps = [
    { op: 'state.set', path: 'x', value: { $now: true } }, { op: 'state.append', path: 'x', value: { a: 1 } },
    { op: 'state.update', path: 'x', index: { $ref: '$index' }, set: { a: true } },
    { op: 'state.remove', path: 'x', index: 0 }, { op: 'state.remove', path: 'x', where: { field: 'done', equals: true } },
    { op: 'state.toggle', path: 'x' }, { op: 'state.increment', path: 'x' }, { op: 'state.reset', path: 'x' },
    { op: 'ai.run', prompt: 'Hi', output: { type: 'list', of: { name: 'string' } }, into: 'x' },
    { op: 'navigate', screen: 'main' }, { op: 'confirm', message: 'Sure?' }, step,
    { op: 'notify', title: 'Hi', body: 'Text' }, { op: 'share', text: 'Hi' },
  ];
  test.each(steps)('action accepts $op', (action) => {
    expect(ActionStepSchema.safeParse(action).success).toBe(true);
    expect(ActionStepSchema.safeParse({ ...action, unknown: 1 }).success).toBe(false);
  });
  test('action defaults', () => {
    expect(ActionStepSchema.parse({ op: 'state.increment', path: 'x' })).toMatchObject({ by: 1 });
    expect(ActionStepSchema.parse({ op: 'ai.run', prompt: '', output: { type: 'string' }, into: 'x' })).toMatchObject({ mode: 'replace' });
  });
  test.each([
    { op: 'eval', code: '1' }, { op: 'state.remove', path: 'x' },
    { op: 'state.remove', path: 'x', index: 0, where: { field: 'a', equals: true } },
    { op: 'state.append', path: 'x', value: 2 }, { op: 'ai.run', prompt: '', into: 'x', output: { type: 'unknown' } },
  ])('invalid action %j', (action) => expect(ActionStepSchema.safeParse(action).success).toBe(false));
  test.each([
    { kind: 'daily', time: '00:00' }, { kind: 'weekly', weekday: 0, time: '23:59' },
    { kind: 'weekly', weekday: 6, time: '12:00' }, { kind: 'once', at: '2026-10-22T12:00:00Z' },
  ])('schedule %j', (schedule) => expect(ScheduleSchema.safeParse(schedule).success).toBe(true));
  test.each([
    { kind: 'monthly', time: '00:00' }, { kind: 'daily', time: '24:00' }, { kind: 'daily', time: '9:00' },
    { kind: 'weekly', weekday: -1, time: '00:00' }, { kind: 'weekly', weekday: 7, time: '00:00' },
    { kind: 'weekly', weekday: 0.5, time: '00:00' }, { kind: 'once', at: 'bad' }, { kind: 'daily', time: '12:60' },
    { kind: 'daily', time: '00:00', at: '2026-10-22' },
  ])('invalid schedule %j', (schedule) => expect(ScheduleSchema.safeParse(schedule).success).toBe(false));
  const trigger = { id: 'daily', type: 'schedule', schedule: { kind: 'daily', time: '09:00' }, notify: { title: '', body: '' } };
  test('strict fixed objects', () => {
    for (const value of [
      { ...spec, extra: 1 }, { ...spec, specVersion: '0.2' }, { ...spec, meta: { ...meta, extra: 1 } },
      { ...spec, screens: [{ ...spec.screens[0], extra: 1 }] }, { ...spec, state: { x: { type: 'number', default: 1, extra: 1 } } },
      { ...spec, actions: { x: { steps: [], extra: 1 } } }, { ...spec, state: { 'bad-key': { type: 'number', default: 1 } } },
    ]) expect(SpecSchema.safeParse(value).success).toBe(false);
    expect(TriggerSchema.safeParse({ ...trigger, extra: 1 }).success).toBe(false);
    expect(TriggerSchema.safeParse({ ...trigger, notify: { title: '', body: '', extra: 1 } }).success).toBe(false);
  });
  test.each([
    ['state', 20, { type: 'number', default: 1 }], ['elements', 60, { type: 'Text', props: {} }], ['actions', 12, { steps: [step] }],
  ])('%s map limits', (key, max, value) => {
    expect(SpecSchema.safeParse({ ...spec, [key]: entries(max as number, value) }).success).toBe(true);
    expect(SpecSchema.safeParse({ ...spec, [key]: entries((max as number) + 1, value) }).success).toBe(false);
    expect(SpecSchema.safeParse({ ...spec, [key]: { 'bad-key': value } }).success).toBe(false);
  });
  test('array limits', () => {
    for (const n of [1, 3]) expect(SpecSchema.safeParse({ ...spec, screens: Array(n).fill(spec.screens[0]) }).success).toBe(true);
    for (const n of [0, 4]) expect(SpecSchema.safeParse({ ...spec, screens: Array(n).fill(spec.screens[0]) }).success).toBe(false);
    expect(ActionSchema.safeParse({ steps: Array(8).fill(step) }).success).toBe(true);
    expect(ActionSchema.safeParse({ steps: Array(9).fill(step) }).success).toBe(false);
    expect(SpecSchema.safeParse({ ...spec, triggers: Array(3).fill(trigger) }).success).toBe(true);
    expect(SpecSchema.safeParse({ ...spec, triggers: Array(4).fill(trigger) }).success).toBe(false);
  });
});
