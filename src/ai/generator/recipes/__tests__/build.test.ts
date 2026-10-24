import { SpecSchema } from '@/spec/schema';
import { validate } from '@/spec/validate';
import { buildAiList } from '../aiList';
import { buildCounter } from '../counter';
import { RECIPES } from '../index';
import { buildLog, type FieldType, type LogConfig, type LogField } from '../log';
import { readSettings } from '../settings';
import { buildSplitter } from '../splitter';

const f = (key: string, type: FieldType): LogField => ({ key, label: key[0].toUpperCase() + key.slice(1), type });
const fieldSets: LogField[][] = [
  [f('name', 'text')],
  [f('name', 'text'), f('amount', 'money')],
  [f('name', 'text'), f('qty', 'number'), f('lastDone', 'date')],
  [f('name', 'text'), f('person', 'text'), f('price', 'money'), f('when', 'date')],
  [f('name', 'text'), f('minutes', 'number'), f('rating', 'number'), f('cost', 'money')],
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
    const numeric = fields.find((x) => x.type === 'number' || x.type === 'money');
    const date = fields.find((x) => x.type === 'date');
    for (const checkbox of [false, true]) for (const share of [false, true]) for (const [r, reminder] of reminders.entries()) {
      for (const total of [null, numeric ? { field: numeric.key, label: 'Total' } : null]) for (const tap of [null, date?.key ?? null]) {
        cases.push([`fields#${i} cb=${checkbox} share=${share} reminder#${r} total=${total?.field} tap=${tap}`,
          { name: 'Test App', icon: '📝', description: 'd', noun: 'thing', fields, checkbox, total, tap, share, reminder }]);
      }
    }
  }
  test('grid size is as expected', () => expect(cases.length).toBeGreaterThan(200));
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

test('an empty reply still builds a valid app from the request alone', () => {
  for (const recipe of Object.values(RECIPES)) check(recipe.make(readSettings(''), 'plant watering reminders'));
});
