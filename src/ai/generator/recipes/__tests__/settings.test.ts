import { parseLog } from '../log';
import { readSettings } from '../settings';

const log = (reply: string) => parseLog(readSettings(reply), 'Track my plants');

test('a type word repeated as the label shows the field name instead', () => {
  const c = log('field name Plant Name\nfield water date date\ntap water date');
  expect(c.fields).toEqual([{ key: 'name', label: 'Plant Name', type: 'text' }, { key: 'water', label: 'Water', type: 'date' }]);
  expect(c.tap).toEqual({ kind: 'date', field: 'water' });
  expect(log('field lastWatered date').fields.find((f) => f.key === 'lastWatered')).toMatchObject({ label: 'Last watered', type: 'date' });
});

test.each([
  ['bullets and bold', '- **name** Plant Pal\n* icon 🌱\n1. field name text Plant'],
  ['colons and equals', 'name: Plant Pal\nicon = 🌱\nfield: name text Plant'],
  ['code fence and prose', 'Sure! Here you go:\n```\nname Plant Pal\nicon 🌱\nfield name text Plant\n```'],
])('%s still read', (_, reply) => {
  const c = log(reply);
  expect(c.name).toBe('Plant Pal');
  expect(c.icon).toBe('🌱');
  expect(c.fields[0]).toMatchObject({ key: 'name', type: 'text' });
});

test('limits: at most 4 fields, a text title is always first, totals and tap must point at real fields', () => {
  const c = log('field a number\nfield b number\nfield c money\nfield d date\nfield e text\ntotal sum zzz\ntap nope');
  expect(c.fields).toHaveLength(4);
  expect(c.fields[0].type).toBe('text');
  expect(c.totals[0]?.field).toBeDefined();
  expect(c.fields.find((f) => f.key === c.totals[0]?.field)?.type).toMatch(/number|money/);
  // The text title pushed the date field out of the 4 slots, so there is nothing to tap.
  expect(c.tap).toBeNull();
  expect(log('field name text\nfield seen date\ntap nope').tap).toEqual({ kind: 'date', field: 'seen' });
});

describe('field types', () => {
  test('choice takes options after the label, or falls back to to-do states', () => {
    const c = log('field title text Task\nfield status choice Status todo|doing|done\nfield priority select Priority\nfield mood choice Mood options: happy, ok, sad');
    expect(c.fields[1]).toEqual({ key: 'status', label: 'Status', type: 'choice', options: ['todo', 'doing', 'done'] });
    expect(c.fields[2].options).toEqual(['To do', 'In progress', 'Done']);
    expect(c.fields[3]).toMatchObject({ label: 'Mood', options: ['happy', 'ok', 'sad'] });
  });
  test('rating, longtext and synonyms', () => {
    const c = log('field title text Book\nfield stars rating Rating\nfield notes notes Thoughts\nfield price price Cost');
    expect(c.fields.map((f) => f.type)).toEqual(['text', 'rating', 'longtext', 'money']);
  });
});

describe('totals, tap, sort', () => {
  const fields = 'field name text Entry\nfield amount money Amount\nfield minutes number Minutes\n';
  test('every total operator, with the old two-word form read as a sum', () => {
    const c = log(`${fields}total sum amount Spent\ntotal avg minutes Average time\ntotal max amount Biggest\ntotal count Entries`);
    expect(c.totals).toEqual([
      { op: 'sum', field: 'amount', label: 'Spent' }, { op: 'avg', field: 'minutes', label: 'Average time' },
      { op: 'max', field: 'amount', label: 'Biggest' }, { op: 'count', label: 'Entries' }].slice(0, 3));
    expect(log(`${fields}total amount Total spent`).totals).toEqual([{ op: 'sum', field: 'amount', label: 'Total spent' }]);
    expect(log(`${fields}total none`).totals).toEqual([]);
  });
  test('a total with no usable number field is dropped', () => {
    expect(log('field name text Entry\ntotal sum amount Spent').totals).toEqual([]);
  });
  test('tap add increments a number field; tap date sets a date', () => {
    expect(log(`${fields}tap add minutes`).tap).toEqual({ kind: 'add', field: 'minutes' });
    expect(log(`${fields}tap add`).tap).toEqual({ kind: 'add', field: 'amount' });
    expect(log('field name text Entry\ntap add').tap).toBeNull();
  });
  test('sort needs a real field and understands direction words', () => {
    expect(log(`${fields}sort amount desc`).sort).toEqual({ field: 'amount', dir: 'desc' });
    expect(log(`${fields}sort name`).sort).toEqual({ field: 'name', dir: 'asc' });
    expect(log(`${fields}sort nothing desc`).sort).toBeNull();
  });
});

test('reminder lines: daily, weekly with a day name, and junk', () => {
  expect(log('reminder daily 8:30 Log it').reminder).toEqual({ kind: 'daily', weekday: 0, time: '08:30', body: 'Log it' });
  expect(log('reminder weekly sun 9pm Water them').reminder).toMatchObject({ kind: 'weekly', weekday: 0, time: '21:00' });
  expect(log('reminder weekly 6 07:00 Check').reminder).toMatchObject({ weekday: 6, time: '07:00' });
  for (const junk of ['reminder soon', 'reminder daily', 'reminder none', 'reminder weekly 25:99']) expect(log(junk).reminder).toBeNull();
});
