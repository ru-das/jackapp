import { SpecSchema } from '@/spec/schema';
import { validate } from '@/spec/validate';
import { buildAiList } from '../aiList';
import { buildCounter } from '../counter';
import { RECIPES } from '../index';
import { buildLog, type FieldType, type LogConfig, type LogField } from '../log';
import { RecipeError } from '../kit';
import { readSettings } from '../settings';
import { buildSplitter } from '../splitter';

const f = (key: string, type: FieldType, options?: string[]): LogField => ({ key, label: key[0].toUpperCase() + key.slice(1), type, ...(options ? { options } : {}) });
const fieldSets: LogField[][] = [
  [f('name', 'text')],
  [f('name', 'text'), f('amount', 'money')],
  [f('name', 'text'), f('qty', 'number'), f('lastDone', 'date')],
  [f('name', 'text'), f('person', 'text'), f('price', 'money'), f('when', 'date')],
  [f('name', 'text'), f('minutes', 'number'), f('rating', 'rating'), f('cost', 'money')],
  [f('title', 'text'), f('status', 'choice', ['To do', 'Doing', 'Done']), f('notes', 'longtext'), f('score', 'rating')],
];
const reminders = [null, { kind: 'daily' as const, weekday: 0, time: '08:30', body: 'Log it' }, { kind: 'weekly' as const, weekday: 6, time: '21:00', body: 'Weekly check' }];

function check(spec: object) {
  expect(validate(spec)).toEqual([]);
  expect(SpecSchema.safeParse(spec).success).toBe(true);
  expect(JSON.stringify(spec).length).toBeLessThan(32768);
}

describe('log recipe builds a valid spec for every combination', () => {
  const cases: [string, LogConfig][] = [];
  for (const [i, fields] of fieldSets.entries()) {
    const numbers = fields.filter((x) => x.type === 'number' || x.type === 'money' || x.type === 'rating');
    const date = fields.find((x) => x.type === 'date');
    const totalSets: LogConfig['totals'][] = [[], ...(numbers[0] ? [[{ op: 'sum' as const, field: numbers[0].key, label: 'Total' }],
      [{ op: 'avg' as const, field: numbers[0].key, label: 'Average' }, { op: 'min' as const, field: numbers[0].key, label: 'Lowest' },
        { op: 'max' as const, field: numbers[0].key, label: 'Highest' }]] : []), [{ op: 'count' as const, label: 'How many' }]];
    const taps: LogConfig['tap'][] = [null, ...(date ? [{ kind: 'date' as const, field: date.key }] : []), ...(numbers[0] ? [{ kind: 'add' as const, field: numbers[0].key }] : [])];
    for (const checkbox of [false, true]) for (const share of [false, true]) for (const [r, reminder] of reminders.entries()) {
      for (const [ti, totals] of totalSets.entries()) for (const tap of taps) for (const sort of [null, { field: fields[0].key, dir: 'desc' as const }]) {
        cases.push([`fields#${i} cb=${checkbox} share=${share} reminder#${r} totals#${ti} tap=${tap?.kind}:${tap?.field} sort=${sort?.field}`,
          { name: 'Test App', icon: '📝', description: 'd', noun: 'thing', fields, checkbox, totals, tap, sort, share, reminder }]);
      }
    }
  }
  test('grid size is as expected', () => expect(cases.length).toBeGreaterThan(1000));
  test.each(cases)('%s', (_, config) => check(buildLog(config)));
});

test.each([1, 5, 100])('counter step %i', (step) => {
  const spec = buildCounter({ name: 'Water', icon: '💧', description: 'd', noun: 'glasses', step });
  check(spec);
  expect(JSON.stringify(spec)).toContain('"state.increment"');
});

test.each([false, true])('splitter share=%s', (share) => check(buildSplitter({ name: 'Bill', icon: '🧾', description: 'd', share })));

test.each([['photo', false], ['photo', true], ['text', false], ['text', true]] as const)('ai-list %s share=%s', (source, share) => {
  check(buildAiList({ name: 'List', icon: '📋', description: 'd', source, instruction: 'List things.', share }));
});

test.each(Object.values(RECIPES))('the $id example reply builds a valid spec', (recipe) => {
  check(recipe.make(readSettings(recipe.example.reply), recipe.example.request));
});

test('an empty reply still builds a valid app from the request alone, except where there is nothing to guess', () => {
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.id === 'calculator') expect(() => recipe.make(readSettings(''), 'tip calculator')).toThrow(RecipeError);
    else check(recipe.make(readSettings(''), 'plant watering reminders'));
  }
});
