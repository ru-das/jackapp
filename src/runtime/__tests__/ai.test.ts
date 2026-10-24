import { createScriptedMock, mockProvider } from '@/ai/providers/mock';
import type { LLMProvider } from '@/ai/provider';
import { h1 } from '@/spec/fixtures';
import { SpecSchema } from '@/spec/schema';
import { createActionEngine } from '../actions';
import { createAiService, AI_TIMEOUT_MS } from '../ai';

const PHOTO = 'data:image/jpeg;base64,AA';
const spec = SpecSchema.parse(h1);
const ctx = { now: new Date('2026-10-23T00:00:00Z'), locale: 'en-US', timeZone: 'UTC', currency: 'USD' };

function setup(provider: LLMProvider, overrides: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = Object.fromEntries(
    Object.entries(spec.state).map(([k, d]) => [k, structuredClone(d.default)]));
  Object.assign(state, { photo: PHOTO, ...overrides });
  const store = { getState: () => state, setState: (n: Record<string, unknown>) => { state = { ...state, ...n }; } };
  const toast = jest.fn();
  const engine = createActionEngine({
    spec, store,
    services: {
      share: jest.fn(), toast, confirm: () => true, navigate: jest.fn(),
      ai: createAiService({ spec, store, getProvider: async () => ({ provider }) }),
    },
    getValueContext: () => ctx,
  });
  return { engine, toast, get: () => state };
}
const rows = (s: Record<string, unknown>) => s.items as Record<string, unknown>[];
beforeEach(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('AT-03: H1 makeList fills items from the mock, applying defaults', async () => {
  const t = setup(mockProvider);
  await t.engine.run('makeList');
  expect(rows(t.get()).map((r) => r.name)).toEqual(['Milk', 'Eggs', 'Butter']);
  expect(rows(t.get()).every((r) => r.done === false)).toBe(true);
});

test('bad JSON then good JSON: one retry succeeds', async () => {
  const p = createScriptedMock(['not json', '{"items":[{"name":"Rice","qty":"1 kg"}]}']);
  const t = setup(p);
  await t.engine.run('makeList');
  expect(rows(t.get())).toEqual([{ name: 'Rice', qty: '1 kg', done: false }]);
});

test('bad twice: state unchanged and the user sees a toast', async () => {
  const t = setup(createScriptedMock(['nope', '{"items":"x"}']));
  await t.engine.run('makeList');
  expect(rows(t.get())).toEqual([]);
  expect(t.toast).toHaveBeenCalledWith('Something went wrong. Please try again.');
});

test('coerces types: numeric/boolean strings, missing fields get defaults then zero values', async () => {
  const s = SpecSchema.parse({ ...h1, actions: { go: { steps: [{ op: 'ai.run', prompt: 'x', output: { type: 'list', of: { name: 'string', qty: 'string' } },
    into: 'items', defaults: { done: true } }] } } });
  let state: Record<string, unknown> = { items: [], photo: null, notes: '' };
  const store = { getState: () => state, setState: (n: Record<string, unknown>) => { state = { ...state, ...n }; } };
  const ai = createAiService({ spec: s, store, getProvider: async () => ({ provider: createScriptedMock(['{"items":[{"name":"A","qty":2,"extra":1},{"name":"B"}]}']) }) });
  await ai({ ...s.actions.go.steps[0] } as never);
  expect(state.items).toEqual([{ name: 'A', qty: '2', done: true }, { name: 'B', qty: '', done: true }]);
});

test('append keeps existing rows', async () => {
  const s = SpecSchema.parse({ ...h1, actions: { go: { steps: [{ op: 'ai.run', prompt: 'x', mode: 'append',
    output: { type: 'list', of: { name: 'string' } }, into: 'items' }] } } });
  let state: Record<string, unknown> = { items: [{ name: 'Old', qty: '1', done: true }] };
  const store = { getState: () => state, setState: (n: Record<string, unknown>) => { state = { ...state, ...n }; } };
  const ai = createAiService({ spec: s, store, getProvider: async () => ({ provider: createScriptedMock(['{"items":[{"name":"New"}]}']) }) });
  await ai(s.actions.go.steps[0] as never);
  expect((state.items as { name: string }[]).map((r) => r.name)).toEqual(['Old', 'New']);
});

test('scalar number output is coerced from a numeric string', async () => {
  const s = SpecSchema.parse({ specVersion: '0.1', meta: { name: 'T', description: '', icon: '🧪' },
    state: { total: { type: 'number', default: 0 } }, screens: [{ id: 'm', title: '', root: 'r' }],
    elements: { r: { type: 'Stack', props: {} } },
    actions: { go: { steps: [{ op: 'ai.run', prompt: 'sum', output: { type: 'number' }, into: 'total' }] } } });
  let state: Record<string, unknown> = { total: 0 };
  const store = { getState: () => state, setState: (n: Record<string, unknown>) => { state = { ...state, ...n }; } };
  const ai = createAiService({ spec: s, store, getProvider: async () => ({ provider: createScriptedMock(['{"value":"42.5"}']) }) });
  await ai(s.actions.go.steps[0] as never);
  expect(state.total).toBe(42.5);
});

test('prompt over 2000 chars never reaches the provider (ADR-015)', async () => {
  const gen = jest.spyOn(mockProvider, 'generate');
  const t = setup(mockProvider, { notes: 'x'.repeat(2100) });
  await t.engine.run('makeList');
  expect(gen).not.toHaveBeenCalled();
  expect(rows(t.get())).toEqual([]);
});

test('AI not set up: no inference', async () => {
  const generate = jest.fn();
  const p = { ...mockProvider, isConfigured: async () => false, generate };
  const t = setup(p);
  await t.engine.run('makeList');
  expect(generate).not.toHaveBeenCalled();
  expect(t.toast).toHaveBeenCalled();
});

test('120 s timeout aborts the provider call', async () => {
  jest.useFakeTimers();
  let aborted = false;
  const p: LLMProvider = { ...mockProvider, generate: ({ signal }) => new Promise((_, reject) => {
    signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  }) };
  const t = setup(p);
  const run = t.engine.run('makeList');
  await jest.advanceTimersByTimeAsync(AI_TIMEOUT_MS + 1);
  await run;
  expect(aborted).toBe(true);
  expect(rows(t.get())).toEqual([]);
});
