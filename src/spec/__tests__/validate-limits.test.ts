import { h2 } from '../fixtures';
import { SpecSchema } from '../schema';
import type { Spec } from '../types';
import { validate } from '../validate';

const minimal = (): Spec => SpecSchema.parse({ specVersion: '0.1', meta: { name: 'Test', description: '', icon: '🧊' },
  state: {}, screens: [{ id: 'main', title: 'Test', root: 'root' }],
  elements: { root: { type: 'Stack', props: {}, children: [] } }, actions: {} });
const entries = <T,>(n: number, value: T) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`a${i}`, value]));
const limit = (input: unknown, path: string) => expect(validate(input)).toEqual(expect.arrayContaining([
  expect.objectContaining({ code: 'LIMIT_EXCEEDED', path }),
]));
test('compact input size includes metadata, uses UTF-8, precedes defaults and ignores whitespace', () => {
  for (const prefix of ['', '🌱é']) {
    const s = minimal(); s.meta.sourcePrompt = prefix;
    const bytes = Buffer.byteLength(JSON.stringify(s));
    s.meta.sourcePrompt += 'x'.repeat(32768 - bytes);
    expect(Buffer.byteLength(JSON.stringify(s))).toBe(32768);
    expect(validate(s)).toEqual([]);
    expect(validate(JSON.stringify(s, null, 4))).toEqual([]);
    s.meta.sourcePrompt += 'x'; limit(s, '');
  }
  const s = { ...minimal(), state: { x: { type: 'list', of: { a: 'number' } } } };
  s.meta.sourcePrompt = '';
  s.meta.sourcePrompt = 'x'.repeat(32768 - Buffer.byteLength(JSON.stringify(s)));
  expect(validate(s)).toEqual([]);
  expect(Buffer.byteLength(JSON.stringify(SpecSchema.parse(s)))).toBeGreaterThan(32768);
});
test('screen count boundary', () => {
  for (const n of [3, 4]) {
    const s = minimal();
    s.screens = Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: 'S', root: `r${i}` }));
    s.elements = entries(0, s.elements.root);
    s.screens.forEach((screen) => { s.elements[screen.root] = { type: 'Divider', props: {} }; });
    if (n === 3) expect(validate(s)).toEqual([]); else limit(s, 'screens');
  }
});
test('element count boundary', () => {
  for (const n of [60, 61]) {
    const s = minimal(); s.elements = { root: s.elements.root, ...entries(n - 1, { type: 'Divider', props: {} } as const) };
    s.elements.root.children = Object.keys(s.elements).filter((id) => id !== 'root');
    if (n === 60) expect(validate(s)).toEqual([]); else limit(s, 'elements');
  }
});
test('state count boundary', () => {
  for (const n of [20, 21]) {
    const s = minimal(); s.state = entries(n, { type: 'number', default: 0, persist: true });
    if (n === 20) expect(validate(s)).toEqual([]); else limit(s, 'state');
  }
});
test('list fields boundary in declarations and AI output', () => {
  for (const n of [8, 9]) {
    const s = minimal(); s.state.items = { type: 'list', of: entries(n, 'string'), default: [], persist: true };
    if (n === 8) expect(validate(s)).toEqual([]); else limit(s, 'state.items.of');
    const input = { ...minimal(), state: { items: { type: 'list', of: entries(8, 'string'), default: [] } },
      actions: { test: { steps: [{ op: 'ai.run', prompt: 'Hi', output: { type: 'list', of: entries(n, 'string') }, into: 'items' }] } } };
    if (n === 8) expect(validate(input)).toEqual([]); else limit(input, 'actions.test.steps[0].output.of');
  }
});
test('action and step counts', () => {
  for (const n of [12, 13]) {
    const s = minimal(); s.actions = entries(n, { steps: [] });
    if (n === 12) expect(validate(s)).toEqual([]); else limit(s, 'actions');
  }
  for (const n of [8, 9]) {
    const s = minimal(); s.actions.test = { steps: Array.from({ length: n }, () => ({ op: 'toast', message: 'Hi' })) };
    if (n === 8) expect(validate(s)).toEqual([]); else limit(s, 'actions.test.steps');
  }
});
test('trigger count boundary', () => {
  for (const n of [3, 4]) {
    const s = minimal(); s.triggers = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, type: 'schedule',
      schedule: { kind: 'daily', time: '09:00' }, notify: { title: 'Hi', body: 'Body' } }));
    if (n === 3) expect(validate(s)).toEqual([]); else limit(s, 'triggers');
  }
});
test('tree depth counts the root as one; deeper descendants are not orphans', () => {
  for (const depth of [8, 9, 10]) {
    const s = minimal(); s.screens[0].root = 'a0';
    s.elements = Object.fromEntries(Array.from({ length: depth }, (_, i) => [`a${i}`, {
      type: 'Stack', props: {}, children: i + 1 < depth ? [`a${i + 1}`] : [],
    }]));
    if (depth === 8) expect(validate(s)).toEqual([]); else {
      limit(s, 'elements.a8'); expect(validate(s).some((e) => e.message.includes('orphan'))).toBe(false);
    }
  }
});
test('expanded prompt count boundary uses defaults, not raw template length', () => {
  for (const n of [2000, 2001]) {
    const s = minimal(); s.state.notes = { type: 'string', default: 'x'.repeat(n), persist: true };
    s.actions.test = { steps: [{ op: 'ai.run', prompt: '{{notes}}', output: { type: 'string' }, into: 'notes', mode: 'replace' }] };
    if (n === 2000) expect(validate(s)).toEqual([]); else limit(s, 'actions.test.steps[0].prompt');
  }
});
test('expanded prompt checks every item default, including the second row', () => {
  for (const n of [2000, 2001]) {
    const s = minimal(); s.state.items = { type: 'list', of: { text: 'string' }, default: [{ text: 'short' }, { text: 'x'.repeat(n) }], persist: true };
    s.state.notes = { type: 'string', default: '', persist: true };
    s.elements.root = { type: 'List', props: { items: 'items', title: 'Item', onItemPress: 'test' } };
    s.actions.test = { steps: [{ op: 'ai.run', prompt: '{{$item.text}}', output: { type: 'string' }, into: 'notes', mode: 'replace' }] };
    if (n === 2000) expect(validate(s)).toEqual([]); else limit(s, 'actions.test.steps[0].prompt');
  }
});
test('empty-list prompt uses a typed zero item, index zero and deterministic settings', () => {
  const s = minimal();
  s.state.items = { type: 'list', of: { name: 'string', n: 'number', flag: 'boolean', at: 'date' }, default: [], persist: true };
  s.state.notes = { type: 'string', default: '', persist: true };
  s.state.date = { type: 'date', default: '2000-01-01T00:00:00Z', persist: true };
  s.elements.root = { type: 'List', props: { items: 'items', title: 'Item', onItemPress: 'test' } };
  const expanded = '|0|false||0|$0.00|in 0 seconds';
  const prompt = '{{$item.name}}|{{$item.n}}|{{$item.flag}}|{{$item.at}}|{{$index}}|{{$item.n|currency}}|{{date|ago}}';
  s.actions.test = { steps: [{ op: 'ai.run', prompt: 'x'.repeat(2000 - expanded.length) + prompt, output: { type: 'string' }, into: 'notes', mode: 'replace' }] };
  expect(validate(s)).toEqual([]);
  s.actions.test.steps[0] = { ...s.actions.test.steps[0], prompt: 'x' + (s.actions.test.steps[0] as { prompt: string }).prompt } as typeof s.actions.test.steps[0];
  limit(s, 'actions.test.steps[0].prompt');
});
test('trigger templates cannot use item context', () => {
  const s = structuredClone(h2); s.triggers[0].notify.body = '{{$index}}';
  expect(validate(s)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BAD_VALUE', path: 'triggers[0].notify.body' })]));
});
