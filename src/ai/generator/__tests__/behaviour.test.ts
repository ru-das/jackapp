import { SpecSchema } from '@/spec/schema';
import { runChecks, type Check } from '../behaviour';

function expenseApp(totalField: string) {
  return SpecSchema.parse({
    specVersion: '0.1', meta: { name: 'Expenses', description: '', icon: '💸' },
    state: {
      name: { type: 'string', default: '' }, amount: { type: 'number', default: 0 }, category: { type: 'string', default: '' },
      day: { type: 'date', default: null },
      items: { type: 'list', of: { name: 'string', amount: 'number', category: 'string', day: 'date' }, default: [] },
    },
    screens: [{ id: 'main', title: 'Expenses', root: 'root' }],
    elements: {
      root: { type: 'Stack', props: {}, children: ['n', 'a', 'c', 'add', 'total', 'list'] },
      n: { type: 'TextInput', props: { bind: 'name', label: 'What was it?' } },
      a: { type: 'NumberInput', props: { bind: 'amount', label: 'Amount', mode: 'field' } },
      c: { type: 'TextInput', props: { bind: 'category', label: 'Category' } },
      add: { type: 'Button', props: { label: 'Add expense', onPress: 'add' } },
      total: { type: 'Stat', props: { label: 'Total spent', value: { $agg: { op: 'sum', of: 'items', field: totalField } } } },
      list: { type: 'List', props: { items: 'items', title: '{{$item.name}}', onItemPress: 'stamp' } },
    },
    actions: {
      add: { steps: [{ op: 'state.append', path: 'items', value: { name: { $ref: 'name' }, amount: { $ref: 'amount' }, category: { $ref: 'category' }, day: { $now: true } } }] },
      stamp: { steps: [{ op: 'state.update', path: 'items', index: { $ref: '$index' }, set: { day: { $now: true } } }] },
    },
  });
}
const add = (name: string, amount: number, category: string): Check['steps'] =>
  [{ fill: { 'what|name': name, amount, categor: category } }, { press: 'add' }];
const intent = (equals: number): Check => ({ layer: 'intent', steps: [...add('Lunch', 12.5, 'Food'), ...add('Bus', 7.5, 'Travel'), { expectStat: 'total', equals }] });

test('a working expense app passes row and total checks', async () => {
  const results = await runChecks(expenseApp('amount'), [
    { layer: 'behaviour', steps: [...add('Lunch', 12.5, 'Food'), { expectRow: ['Lunch', 12.5, 'Food'] }] }, intent(20),
  ]);
  expect(results).toEqual([{ layer: 'behaviour', passed: true }, { layer: 'intent', passed: true }]);
});

test('an app that sums the wrong field fails intent with the shown value', async () => {
  const [result] = await runChecks(expenseApp('day'), [intent(20)]);
  expect(result.passed).toBe(false);
  expect(result.reason).toMatch(/Total|total/);
});

test('missing label, wrong value type and missing button give short reasons', async () => {
  const spec = expenseApp('amount');
  const run = async (steps: Check['steps']) => (await runChecks(spec, [{ layer: 'behaviour', steps }]))[0].reason;
  expect(await run([{ fill: { weight: 1 } }])).toBe('no input labelled /weight/');
  expect(await run([{ fill: { amount: 'lots' } }])).toMatch(/takes a number/);
  expect(await run([{ press: 'delete' }])).toBe('no button labelled /delete/');
  expect(await run([{ expectRow: ['ghost'] }])).toMatch(/no row containing/);
});

test('pressing a list row runs onItemPress and $today matches the fixed date', async () => {
  const [result] = await runChecks(expenseApp('amount'), [{ layer: 'behaviour', steps: [
    ...add('Lunch', 1, 'Food'), { press: 'row', row: 0 }, { expectRow: ['Lunch', '$today'] }] }]);
  expect(result).toEqual({ layer: 'behaviour', passed: true });
});

test('a failing action is reported, not thrown', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const [result] = await runChecks(expenseApp('amount'), [{ layer: 'behaviour', steps: [{ press: 'row', row: 3 }] }]);
    expect(result).toMatchObject({ passed: false, reason: 'no list row 3 to press' });
  } finally { err.mockRestore(); }
});
