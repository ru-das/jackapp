import { assemble, NOW, ref, reminderTrigger, RecipeError, tree, type Obj, type Reminder } from './kit';
import { cleanText, first, flag, icon, nameFromRequest, reminder, type Settings } from './settings';
import type { Recipe } from './types';

export type ReminderConfig = { name: string; icon: string; description: string; message: string; reminders: Reminder[]; done: boolean };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const when = (r: Reminder) => `${r.kind === 'daily' ? 'Every day' : `Every ${DAYS[r.weekday]}`} at ${r.time}`;

export function buildReminder(c: ReminderConfig): Obj {
  const t = tree();
  const lines = c.reminders.map((r) => t.add('Text', { value: `${when(r)}: ${r.body}`, variant: 'body' }));
  const schedule = t.add('Card', { title: c.message, subtitle: 'Your reminders' }, lines);
  const kids = [schedule];
  if (c.done) {
    const press = t.add('Button', { label: 'Done', onPress: 'markDone', variant: 'primary' });
    const times = t.add('Stat', { label: 'Times done', value: ref('count'), format: 'number' });
    const last = t.add('Stat', { label: 'Last done', value: ref('last'), format: 'ago' });
    kids.push(t.add('Card', { title: 'Check in' }, [press, times, last]));
  }
  const root = t.add('Stack', { gap: 'md' }, kids);
  return assemble({ name: c.name, description: c.description, icon: c.icon },
    c.done ? { count: { type: 'number', default: 0 }, last: { type: 'date', default: null } } : {}, root, t.elements,
    c.done ? { markDone: { steps: [{ op: 'state.increment', path: 'count', by: 1 }, { op: 'state.set', path: 'last', value: NOW }, { op: 'toast', message: 'Logged.' }] } } : {},
    c.reminders.map((r, i) => ({ ...reminderTrigger(c.name, r), id: `reminder${i + 1}` })));
}

export function parseReminder(s: Settings, request: string, notes: string[] = []): ReminderConfig {
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  const parsed = (s.get('reminder') ?? []).map((line) => ({ line, r: reminder(line, name) }));
  const reminders = parsed.map((p) => p.r).filter((r): r is Reminder => r !== null).slice(0, 3);
  for (const p of parsed) if (!p.r) notes.push('Couldn’t read one of the reminder times, so it was left out.');
  if (parsed.filter((p) => p.r).length > 3) notes.push('Only 3 reminders fit, so the rest were left out.');
  if (!reminders.length) throw new RecipeError('The reminder has no usable schedule.');
  const message = cleanText(first(s, 'message'), 60, reminders[0].body);
  return {
    name, icon: icon(first(s, 'icon'), '⏰'), description: cleanText(first(s, 'description'), 140, `${name}: reminders on your schedule`),
    message, reminders, done: flag(first(s, 'done'), true),
  };
}

export const reminderRecipe: Recipe = {
  id: 'reminder', version: 1, title: 'Reminder', hint: 'notifications at set times: daily or weekly reminders, with a Done button to check in',
  summary: 'Up to three reminders at fixed times (daily or weekly) that show a notification, plus a Done button that counts check-ins.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
message <what to be reminded of>
reminder daily HH:MM <text>   or   reminder weekly <0-6> HH:MM <text>   (1 to 3 lines; 0 = Sunday)
done <yes|no>   (a Done button that counts check-ins)`,
  example: {
    request: 'Remind me to drink water every morning and afternoon',
    reply: `name Water Reminder
icon 💧
description Reminders to drink water
message Drink a glass of water
reminder daily 09:00 Time for a glass of water
reminder daily 15:00 Another glass of water
done yes`,
  },
  make: (s, request, notes) => buildReminder(parseReminder(s, request, notes)),
};
