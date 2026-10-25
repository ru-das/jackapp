import { createActionEngine, type ActionServices } from '@/runtime/actions';
import { SpecSchema } from '@/spec/schema';
import { readSettings } from '../settings';
import { parseAi, buildAi } from '../ai';
import { buildLog } from '../log';
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
  ].map((row) => ({ ...row, check: '' }));
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
    expect(store.getState().lines).toEqual(expect.arrayContaining([{ name: 'Pasta', price: 10, kind: 'item', check: '' }]));
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
    expect(services.share).toHaveBeenCalledWith('Bill Splitter: bill 60.00 + tip 9.00 = 69.00 EUR\n3 people, 23.00 EUR each');
  });
});

describe('plant log with a date tap', () => {
  const day = (iso: string) => new Date(iso).toISOString();
  const make = () => {
    const f = run(buildLog({
      name: 'Plant Pal', icon: '🌱', description: 'd', noun: 'plant', checkbox: false, totals: [], tap: { kind: 'date', field: 'lastWatered' },
      sort: null, share: false, reminder: null,
      fields: [{ key: 'name', label: 'Plant', type: 'text' }, { key: 'lastWatered', label: 'Last watered', type: 'date' }],
    }));
    f.store.setState({ items: [{ name: 'Fern', lastWatered: day('2026-10-01') }, { name: 'Cactus', lastWatered: day('2026-09-01') }] });
    return f;
  };
  const items = (f: ReturnType<typeof make>) => f.store.getState().items as { lastWatered: string }[];

  test('opening a plant shows it; "Watered now" stamps today; Undo restores the old date', async () => {
    const f = make();
    await f.engine.run('open', { item: items(f)[1], index: 1 });
    expect(f.store.getState()).toMatchObject({ selIndex: 1, selName: 'Cactus' });
    expect(f.services.navigate).toHaveBeenCalledWith('item');
    await f.engine.run('now');
    expect(items(f)[1].lastWatered).toBe('2026-10-22T12:00:00.000Z');
    expect(items(f)[0].lastWatered).toBe(day('2026-10-01'));
    await f.engine.run('undo');
    expect(items(f)[1].lastWatered).toBe(day('2026-09-01'));
  });

  test('an earlier day can be saved, and undone', async () => {
    const f = make();
    await f.engine.run('open', { item: items(f)[0], index: 0 });
    f.store.setState({ pickDay: day('2026-10-15') });
    await f.engine.run('saveDay');
    expect(items(f)[0].lastWatered).toBe(day('2026-10-15'));
    await f.engine.run('undo');
    expect(items(f)[0].lastWatered).toBe(day('2026-10-01'));
  });
});

describe('fridge compare', () => {
  const make = (usual = 'milk, eggs, bread, butter') => {
    const config = parseAi(readSettings(`name Fridge Snap\ninput photo photo Fridge photo\noutput checklist\nusual ${usual}`), 'Take a photo of my fridge and make me a grocery list of what is running low');
    return run(buildAi(config), { seen: [{ name: 'Eggs' }, { name: 'oat milk' }, { name: 'Jam' }] });
  };

  test('a fridge photo request becomes read, correct, compare, even if the model asked for a checklist', () => {
    expect(parseAi(readSettings('output checklist'), 'grocery list from a photo of my fridge').output).toBe('compare');
    expect(parseAi(readSettings('output checklist'), 'make a list from a photo of my receipt').output).toBe('checklist');
  });

  test('the list holds usual items not seen; plurals and partial names count as seen; corrections change the result', async () => {
    const f = make();
    await f.engine.run('look');
    await f.engine.run('makeList');
    expect(f.store.getState().items).toEqual([{ name: 'Bread', done: false }, { name: 'Butter', done: false }]);
    f.store.setState({ newSeen: 'Bread' });
    await f.engine.run('addSeen');
    await f.engine.run('makeList');
    expect(f.store.getState().items).toEqual([{ name: 'Butter', done: false }]);
  });

  test('nothing seen means every usual item is listed, nothing is dropped from the usual list', async () => {
    const f = make();
    await f.engine.run('makeList');
    expect((f.store.getState().items as unknown[]).length).toBe(4);
    expect((f.store.getState().staples as unknown[]).length).toBe(4);
  });
});

describe('editing a log entry', () => {
  const config = { name: 'Spend', icon: '💸', description: 'd', noun: 'expense', fields: [{ key: 'name', label: 'What', type: 'text' as const }, { key: 'amount', label: 'Amount', type: 'money' as const }],
    checkbox: false, totals: [], tap: null, sort: null, share: false, reminder: null };
  test('tap opens a fix screen; Save updates the row, Delete removes it', async () => {
    const { store, engine, services } = run(buildLog(config));
    store.setState({ items: [{ name: 'Tea', amount: 3 }, { name: 'Cab', amount: 20 }] });
    await engine.run('edit', { item: { name: 'Cab', amount: 20 }, index: 1 });
    expect(services.navigate).toHaveBeenCalledWith('edit');
    store.setState({ fixName: 'Taxi', fixAmount: 25 });
    await engine.run('saveEdit');
    expect(store.getState().items).toEqual([{ name: 'Tea', amount: 3 }, { name: 'Taxi', amount: 25 }]);
    await engine.run('deleteEdit');
    expect(store.getState().items).toEqual([{ name: 'Tea', amount: 3 }]);
  });
});
