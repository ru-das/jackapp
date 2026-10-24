import { RecipeError } from '../kit';
import { buildReminder, parseReminder } from '../reminder';
import { readSettings } from '../settings';

const parse = (reply: string) => parseReminder(readSettings(reply), 'Remind me to drink water');

test('up to three reminders become triggers with stable ids and the app name as the title', () => {
  const c = parse('name Water\nmessage Drink\nreminder daily 09:00 Glass 1\nreminder weekly sun 18:00 Plan\nreminder daily 8pm Glass 3\nreminder daily 10:00 Too many');
  expect(c.reminders.map((r) => `${r.kind} ${r.time}`)).toEqual(['daily 09:00', 'weekly 18:00', 'daily 20:00']);
  const spec = buildReminder(c) as { triggers: { id: string; notify: { title: string; body: string } }[] };
  expect(spec.triggers.map((t) => t.id)).toEqual(['reminder1', 'reminder2', 'reminder3']);
  expect(spec.triggers[0].notify).toEqual({ title: 'Water', body: 'Glass 1' });
});

test('lines that are not schedules are ignored, and no schedule at all is not a reminder app', () => {
  expect(parse('reminder soon\nreminder daily 7:15 Stretch').reminders).toHaveLength(1);
  expect(() => parse('name Water\nreminder soon')).toThrow(RecipeError);
  expect(() => parse('')).toThrow(RecipeError);
});

test('the Done check-in is optional', () => {
  expect(parse('reminder daily 09:00 Hi\ndone no').done).toBe(false);
  expect(Object.keys((buildReminder(parse('reminder daily 09:00 Hi\ndone no')) as { actions: object }).actions)).toEqual([]);
  expect(Object.keys((buildReminder(parse('reminder daily 09:00 Hi')) as { actions: object }).actions)).toEqual(['markDone']);
});
