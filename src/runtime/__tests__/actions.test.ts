import { SpecSchema } from '@/spec/schema';
import type { ActionStep, Value } from '@/spec/types';
import { createActionEngine, type ActionServices } from '../actions';

const settings = { now: new Date('2026-10-22T00:00:00Z'), locale: 'en-US', timeZone: 'UTC', currency: 'USD' };
const row = { name: 'Milk', price: 40, done: false, date: null };
function setup(steps: unknown[], extra: Record<string, unknown[]> = {}) {
  const spec = SpecSchema.parse({
    specVersion: '0.1', meta: { name: 'Test', description: '', icon: '🧪' },
    state: {
      count: { type: 'number', default: 2 }, text: { type: 'string', default: 'hello' },
      flag: { type: 'boolean', default: false }, date: { type: 'date', default: null },
      image: { type: 'image', default: null },
      items: { type: 'list', of: { name: 'string', price: 'number', done: 'boolean', date: 'date' }, default: [row] },
      other: { type: 'list', of: { name: 'string', price: 'number', done: 'boolean', date: 'date' }, default: [] },
    },
    screens: [{ id: 'main', title: '', root: 'root' }], elements: { root: { type: 'Stack', props: {} } },
    actions: Object.fromEntries(Object.entries({ run: steps, ...extra }).map(([id, steps]) => [id, { steps }])),
  });
  let state: Record<string, unknown> = Object.fromEntries(Object.entries(spec.state).map(([k, d]) => [k, structuredClone(d.default)]));
  const store = {
    getState: () => state,
    setState: jest.fn((next: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown>)) => {
      state = { ...state, ...(typeof next === 'function' ? next(state) : next) };
    }),
  };
  const services = {
    share: jest.fn<ReturnType<ActionServices['share']>, Parameters<ActionServices['share']>>().mockImplementation(() => {}),
    toast: jest.fn<ReturnType<ActionServices['toast']>, Parameters<ActionServices['toast']>>().mockImplementation(() => {}),
    confirm: jest.fn<ReturnType<ActionServices['confirm']>, Parameters<ActionServices['confirm']>>().mockReturnValue(true),
    navigate: jest.fn<ReturnType<ActionServices['navigate']>, Parameters<ActionServices['navigate']>>().mockImplementation(() => {}),
    notify: jest.fn<ReturnType<NonNullable<ActionServices['notify']>>, Parameters<NonNullable<ActionServices['notify']>>>().mockImplementation(() => {}),
    ai: jest.fn<ReturnType<NonNullable<ActionServices['ai']>>, Parameters<NonNullable<ActionServices['ai']>>>().mockImplementation(() => {}),
  };
  const warning = jest.fn();
  const getValueContext = jest.fn(() => ({ ...settings, onWarning: warning }));
  const engine = createActionEngine({ spec, store, services, getValueContext });
  return { spec, store, services, engine, warning, getValueContext };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
let log: jest.SpyInstance;
beforeEach(() => { log = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { log.mockRestore(); });

test('set, default/custom increment and toggle observe preceding writes', async () => {
  const { engine, store } = setup([
    { op: 'state.set', path: 'count', value: 3 }, { op: 'state.increment', path: 'count' },
    { op: 'state.increment', path: 'count', by: { $ref: 'count' } },
    { op: 'state.toggle', path: 'flag' }, { op: 'state.set', path: 'text', value: '{{count}}: {{flag}}' },
  ]);
  await engine.run('run');
  expect(store.getState()).toMatchObject({ count: 8, flag: true, text: '8: true' });
  expect(store.setState).toHaveBeenCalledTimes(5);
});

test('append and partial update resolve all fields from a pre-step snapshot, without mutation', async () => {
  const { engine, store, spec } = setup([
    { op: 'state.append', path: 'items', value: { name: '{{items|count}}', price: { $agg: { op: 'sum', of: 'items', field: 'price' } }, done: true, date: { $now: true } } },
    { op: 'state.update', path: 'items', index: 0, set: { name: '{{items|count}}', price: { $agg: { op: 'sum', of: 'items', field: 'price' } } } },
  ]);
  const initial = store.getState();
  const specBefore = structuredClone(spec);
  Object.freeze(initial);
  Object.freeze(initial.items);
  Object.freeze((initial.items as object[])[0]);
  await engine.run('run');
  expect(store.getState().items).toEqual([
    { ...row, name: '2', price: 80 }, { name: '1', price: 40, done: true, date: settings.now.toISOString() },
  ]);
  expect(initial.items).toEqual([row]);
  expect(spec).toEqual(specBefore);
  expect(store.setState).toHaveBeenCalledTimes(2);
});

test('both remove forms use current list indices and strict filter equality', async () => {
  const { engine, store } = setup([
    { op: 'state.remove', path: 'items', where: { field: 'done', equals: false } },
    { op: 'state.remove', path: 'items', index: 0 },
  ]);
  store.setState({ items: [row, { ...row, done: true }, { ...row, name: 'Last', done: true }] });
  await engine.run('run');
  expect(store.getState().items).toEqual([{ ...row, name: 'Last', done: true }]);
  const strict = setup([{ op: 'state.remove', path: 'items', where: { field: 'price', equals: '40' } }]);
  await strict.engine.run('run');
  expect(strict.store.getState().items).toEqual([row]);
});

test('nullable references, whole-list set and resets clone values and defaults', async () => {
  const { engine, store, spec } = setup([
    { op: 'state.set', path: 'date', value: { $ref: 'date' } },
    { op: 'state.set', path: 'image', value: { $ref: 'image' } },
    { op: 'state.set', path: 'other', value: { $ref: 'items' } },
    { op: 'state.reset', path: 'items' },
  ]);
  const old = store.getState().items;
  await engine.run('run');
  expect(store.getState()).toMatchObject({ date: null, image: null, other: [row], items: [row] });
  expect(store.getState().other).not.toBe(old);
  const reset = store.getState().items as typeof row[];
  expect(reset).not.toBe(spec.state.items.default);
  reset[0].name = 'Changed';
  await engine.run('run');
  expect(store.getState().items).toEqual([row]);
  expect(spec.state.items.default).toEqual([row]);
});

test.each(['state.update', 'state.remove'] as const)('%s rejects invalid dynamic indices atomically', async (op) => {
  for (const invalid of [-1, 1, 0.5, NaN, Infinity, '0', null, undefined]) {
    const { engine, store, services } = setup([
      { op, path: 'items', index: { $ref: 'count' }, ...(op === 'state.update' ? { set: { name: 'bad' } } : {}) },
      { op: 'state.toggle', path: 'flag' },
    ]);
    store.setState({ count: invalid });
    store.setState.mockClear();
    await engine.run('run');
    expect(store.setState).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ items: [row], flag: false });
    expect(services.toast).toHaveBeenCalledTimes(1);
    expect(engine.isBusy('run')).toBe(false);
  }
});

test.each([
  { op: 'state.set', path: 'count', value: 'bad' },
  { op: 'state.set', path: 'count', value: { $ref: 'missing' } },
  { op: 'state.set', path: 'date', value: 'yesterday' },
  { op: 'state.set', path: 'image', value: 'https://example.com' },
  { op: 'state.set', path: 'items', value: { $ref: 'text' } },
  { op: 'state.append', path: 'items', value: { name: 'missing fields' } },
  { op: 'state.update', path: 'items', index: 0, set: { price: 'bad' } },
  { op: 'state.update', path: 'items', index: 0, set: { extra: true } },
  { op: 'state.increment', path: 'count', by: '3' },
])('invalid candidate $op on $path leaves the step uncommitted', async (step) => {
  const { engine, store, services } = setup([step]);
  const before = structuredClone(store.getState());
  await engine.run('run');
  expect(store.getState()).toEqual(before);
  expect(store.setState).not.toHaveBeenCalled();
  expect(services.toast).toHaveBeenCalledTimes(1);
});

test('increment overflow is rejected', async () => {
  const { engine, store } = setup([{ op: 'state.increment', path: 'count', by: Number.MAX_VALUE }]);
  store.setState({ count: Number.MAX_VALUE });
  store.setState.mockClear();
  await engine.run('run');
  expect(store.setState).not.toHaveBeenCalled();
});

test.each<Value>([
  { $math: ['/', 5, 0] }, { $math: ['round', 1.25, { $ref: 'count' }] },
])('numeric warnings retain resolver fallback for %j', async (value) => {
  const { engine, store, warning, services } = setup([{ op: 'state.set', path: 'count', value }]);
  store.setState({ count: 0.5 });
  await engine.run('run');
  expect(store.getState().count).toBe(0);
  expect(warning).toHaveBeenCalledTimes(1);
  expect(services.toast).not.toHaveBeenCalled();
});

test('dynamic rounding digits reject overflow/underflow and permit valid negative digits', async () => {
  for (const [digits, result, warnings] of [[400, 0, 1], [-400, 0, 1], [-1, 120, 0]]) {
    const f = setup([{ op: 'state.set', path: 'count', value: { $math: ['round', 123, { $ref: 'count' }] } }]);
    f.store.setState({ count: digits });
    await f.engine.run('run');
    expect(f.store.getState().count).toBe(result);
    expect(f.warning).toHaveBeenCalledTimes(warnings);
  }
});

test('services run in order, await completion and preserve invocation across awaits', async () => {
  const gate = deferred();
  const f = setup([
    { op: 'share', text: '{{$item.name}} {{$index}}' },
    { op: 'confirm', message: '{{text|upper}}?' },
    { op: 'state.update', path: 'items', index: { $ref: '$index' }, set: { name: { $ref: '$item.name' } } },
    { op: 'notify', title: '{{text}}', body: '{{$item.name}}' },
    { op: 'navigate', screen: 'main' }, { op: 'toast', message: '{{items|count}} {{count|currency}}' },
  ]);
  f.services.share.mockReturnValue(gate.promise);
  const invocation = { item: { name: 'Captured' }, index: 0 };
  const pending = f.engine.run('run', invocation);
  invocation.item.name = 'Changed'; invocation.index = 1;
  expect(f.services.share).toHaveBeenCalledWith('Captured 0');
  expect(f.services.confirm).not.toHaveBeenCalled();
  f.store.setState({ text: 'fresh' });
  gate.resolve(); await pending;
  expect(f.services.confirm).toHaveBeenCalledWith('FRESH?');
  expect(f.store.getState().items).toEqual([{ ...row, name: 'Captured' }]);
  expect(f.services.notify).toHaveBeenCalledWith({ title: 'fresh', body: 'Captured' });
  expect(f.services.navigate).toHaveBeenCalledWith('main');
  expect(f.services.toast).toHaveBeenCalledWith('1 $2.00');
  expect(f.getValueContext).toHaveBeenCalledTimes(6);
});

test('declined confirmation stops quietly and releases busy state', async () => {
  const f = setup([{ op: 'confirm', message: 'Sure?' }, { op: 'state.toggle', path: 'flag' }]);
  f.services.confirm.mockResolvedValue(false);
  await f.engine.run('run');
  expect(f.store.setState).not.toHaveBeenCalled();
  expect(f.services.toast).not.toHaveBeenCalled();
  expect(f.engine.isBusy('run')).toBe(false);
});

test.each(['throw', 'reject'] as const)('service %s preserves earlier writes, stops and logs step details', async (kind) => {
  const f = setup([{ op: 'state.increment', path: 'count' }, { op: 'share', text: 'fail' }, { op: 'state.toggle', path: 'flag' }]);
  const error = new Error('private technical detail');
  f.services.share.mockImplementation(() => { if (kind === 'throw') throw error; return Promise.reject(error); });
  await f.engine.run('run');
  expect(f.store.getState()).toMatchObject({ count: 3, flag: false });
  expect(log).toHaveBeenCalledWith('Action failed', expect.objectContaining({ actionId: 'run', stepIndex: 1, error }));
  expect(f.services.toast).toHaveBeenCalledWith('Something went wrong. Please try again.');
  expect(f.engine.isBusy('run')).toBe(false);
});

test('failed error toasts are contained and busy still clears', async () => {
  const f = setup([{ op: 'toast', message: 'test' }]);
  f.services.toast.mockRejectedValue(new Error('toast failed'));
  await expect(f.engine.run('run')).resolves.toBeUndefined();
  expect(f.services.toast).toHaveBeenCalledTimes(2);
  expect(f.engine.isBusy('run')).toBe(false);
});

test.each(['ai.run', 'notify'] as const)('missing %s handler stops with friendly toast', async (op) => {
  const f = setup([op === 'ai.run' ? { op, prompt: 'hi', output: { type: 'string' }, into: 'text' } : { op, title: 'hi', body: 'there' }, { op: 'state.toggle', path: 'flag' }]);
  const services: ActionServices = { ...f.services, ai: undefined, notify: undefined };
  const engine = createActionEngine({ ...f, services });
  await engine.run('run');
  expect(f.services.toast).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
  expect(f.store.getState().flag).toBe(false);
  expect(engine.isBusy('run')).toBe(false);
});

test('AI receives resolved inputs and defaults; later steps await its state writes', async () => {
  const gate = deferred();
  const f = setup([
    { op: 'ai.run', prompt: '{{text}} {{$item.name}}', image: { $ref: 'image' }, output: { type: 'list', of: { name: 'string' } }, into: 'items', mode: 'append', defaults: { done: false, price: 0, date: null } },
    { op: 'toast', message: '{{items|count}}' },
  ]);
  f.services.ai.mockImplementation(async (step) => {
    await gate.promise;
    f.store.setState({ items: [...f.store.getState().items as object[], { ...step.defaults, name: 'AI' }] });
  });
  const pending = f.engine.run('run', { item: { name: 'List item' } });
  expect(f.services.ai).toHaveBeenCalledWith({ op: 'ai.run', prompt: 'hello List item', image: null, output: { type: 'list', of: { name: 'string' } }, into: 'items', mode: 'append', defaults: { done: false, price: 0, date: null } });
  expect(f.services.toast).not.toHaveBeenCalled();
  expect(f.engine.isBusy('run')).toBe(true);
  gate.resolve(); await pending;
  expect(f.services.toast).toHaveBeenCalledWith('2');
  expect(f.spec.actions.run.steps[0]).toMatchObject({ prompt: '{{text}} {{$item.name}}' });
});

test('busy subscription, unsubscribe, duplicate suppression and independent action IDs', async () => {
  const gate = deferred();
  const f = setup([{ op: 'share', text: 'wait' }], { other: [{ op: 'state.increment', path: 'count' }] });
  f.services.share.mockReturnValue(gate.promise);
  const transitions: boolean[][] = [];
  const listener = jest.fn(() => transitions.push([f.engine.isBusy('run'), f.engine.isBusy('other')]));
  const unsubscribe = f.engine.subscribe(listener);
  const pending = f.engine.run('run');
  await f.engine.run('run');
  await f.engine.run('other');
  expect(f.services.share).toHaveBeenCalledTimes(1);
  expect(f.store.getState().count).toBe(3);
  expect(transitions).toEqual([[true, false], [true, true], [true, false]]);
  gate.resolve(); await pending;
  expect(transitions.at(-1)).toEqual([false, false]);
  unsubscribe();
  await f.engine.run('other');
  expect(listener).toHaveBeenCalledTimes(4);
});

test('unknown action and throwing context supplier release busy state', async () => {
  const f = setup([{ op: 'state.toggle', path: 'flag' }]);
  await f.engine.run('missing');
  expect(f.engine.isBusy('missing')).toBe(false);
  f.getValueContext.mockImplementation(() => { throw new Error('clock'); });
  await f.engine.run('run');
  expect(f.engine.isBusy('run')).toBe(false);
  expect(f.store.setState).not.toHaveBeenCalled();
});

test.each<ActionStep>([
  { op: 'notify', title: '{{text}}', body: '{{count}}' },
  { op: 'navigate', screen: 'main' }, { op: 'toast', message: '{{text}}' },
  { op: 'ai.run', prompt: '{{text}}', output: { type: 'string' }, into: 'text', mode: 'replace' },
])('$op waits for its handler before the next step', async (step) => {
  const f = setup([step, { op: 'state.toggle', path: 'flag' }]);
  const gate = deferred();
  const handler = step.op === 'ai.run' ? f.services.ai : step.op === 'notify' ? f.services.notify
    : step.op === 'navigate' ? f.services.navigate : f.services.toast;
  handler.mockReturnValue(gate.promise);
  const pending = f.engine.run('run');
  expect(f.store.getState().flag).toBe(false);
  expect(f.engine.isBusy('run')).toBe(true);
  gate.resolve(); await pending;
  expect(f.store.getState().flag).toBe(true);
});
