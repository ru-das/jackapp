import { parseLog } from '../log';
import { readSettings } from '../settings';

const log = (reply: string) => parseLog(readSettings(reply), 'Track my plants');

test('a type word repeated as the label shows the field name instead', () => {
  const c = log('field name Plant Name\nfield water date date\ntap water date');
  expect(c.fields).toEqual([{ key: 'name', label: 'Plant Name', type: 'text' }, { key: 'water', label: 'Water', type: 'date' }]);
  expect(c.tap).toBe('water');
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

test('limits: at most 4 fields, a text title is always first, total and tap must point at real fields', () => {
  const c = log('field a number\nfield b number\nfield c money\nfield d date\nfield e text\ntotal zzz\ntap nope');
  expect(c.fields).toHaveLength(4);
  expect(c.fields[0].type).toBe('text');
  expect(c.total?.field).toBeDefined();
  expect(c.fields.find((f) => f.key === c.total?.field)?.type).toMatch(/number|money/);
  // The text title pushed the date field out of the 4 slots, so there is nothing to tap.
  expect(c.tap).toBeNull();
  expect(log('field name text\nfield seen date\ntap nope').tap).toBe('seen');
});

test('reminder lines: daily, weekly with a day name, and junk', () => {
  expect(log('reminder daily 8:30 Log it').reminder).toEqual({ kind: 'daily', weekday: 0, time: '08:30', body: 'Log it' });
  expect(log('reminder weekly sun 9pm Water them').reminder).toMatchObject({ kind: 'weekly', weekday: 0, time: '21:00' });
  expect(log('reminder weekly 6 07:00 Check').reminder).toMatchObject({ weekday: 6, time: '07:00' });
  for (const junk of ['reminder soon', 'reminder daily', 'reminder none', 'reminder weekly 25:99']) expect(log(junk).reminder).toBeNull();
});
