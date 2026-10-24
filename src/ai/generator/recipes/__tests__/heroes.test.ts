import { createActionEngine, type ActionServices } from '@/runtime/actions';
import { SpecSchema } from '@/spec/schema';
import { buildSplitter } from '../splitter';

const settings = { now: new Date('2026-10-22T12:00:00Z'), locale: 'en-US', timeZone: 'UTC', currency: 'USD' };

/** Runs a built spec's actions for real; `ai` writes whatever the test says the model returned. */
function run(built: object, ai: Record<string, unknown> = {}) {
  const spec = SpecSchema.parse(built);
  let state: Record<string, unknown> = Object.fromEntries(Object.entries(spec.state).map(([k, d]) => [k, structuredClone(d.default)]));
  const store = { getState: () => state, setState: (next: Record<string, unknown>) => { state = { ...state, ...next }; } };
  const services = {
    share: jest.fn(), toast: jest.fn(), confirm: jest.fn(() => true), navigate: jest.fn(),
    ai: jest.fn(async (step: { into: string }) => { store.setState({ [step.into]: ai[step.into] }); }),
  } as unknown as ActionServices;
  const engine = createActionEngine({ spec, store, services, getValueContext: () => settings });
  return { store, services, engine };
}

describe('splitter', () => {
  const receipt = [
    { name: 'Pasta', price: 20, kind: 'item' }, { name: 'Wine', price: 30, kind: 'item' }, { name: 'Subtotal', price: 50, kind: 'subtotal' },
    { name: 'Tax', price: 5, kind: 'tax' }, { name: 'Service', price: 5, kind: 'service' }, { name: 'Total', price: 60, kind: 'total' },
  ];
  const make = () => run(buildSplitter({ name: 'Bill Splitter', icon: '🧾', description: 'd', currency: 'EUR' }), { lines: receipt });

  test('reading counts items, tax and service once; subtotal and total rows are not added', async () => {
    const { engine, store } = make();
    await engine.run('readBill');
    expect(store.getState().billTotal).toBe(60);
  });

  test('a printed total larger than the lines wins (a missed line)', async () => {
    const { engine, store } = run(buildSplitter({ name: 'B', icon: '🧾', description: 'd', currency: 'USD' }),
      { lines: [{ name: 'Pasta', price: 20, kind: 'item' }, { name: 'Total', price: 60, kind: 'total' }] });
    await engine.run('readBill');
    expect(store.getState().billTotal).toBe(60);
  });

  test('fixing a line recalculates; deleting a line too', async () => {
    const { engine, store } = make();
    await engine.run('readBill');
    await engine.run('editLine', { item: receipt[0], index: 0 });
    store.setState({ editPrice: 10 });
    await engine.run('saveLine');
    expect(store.getState().lines).toEqual(expect.arrayContaining([{ name: 'Pasta', price: 10, kind: 'item' }]));
    expect(store.getState().billTotal).toBe(60); // the printed total still wins; the user types a new one if it is wrong
    store.setState({ billTotal: 50 });
    await engine.run('editLine', { item: receipt[1], index: 1 });
    await engine.run('deleteLine');
    expect((store.getState().lines as unknown[]).length).toBe(5);
  });

  test('tip buttons and the share text', async () => {
    const { engine, store, services } = make();
    await engine.run('readBill');
    await engine.run('tip15');
    expect(store.getState().tip).toBe(9);
    store.setState({ people: 3 });
    await engine.run('share');
    expect(services.share).toHaveBeenCalledWith('Bill Splitter: 60.00 + tip 9.00 EUR between 3 people');
  });
});
