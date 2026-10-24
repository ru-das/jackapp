import { parseTimer } from '../timer';
import { readSettings } from '../settings';
import { parseLog } from '../log';

const timer = (reply: string) => parseTimer(readSettings(reply), 'Pomodoro timer');

test.each([
  ['minutes 25', 1500], ['minutes 25 min', 1500], ['minutes: 1.5', 90], ['duration 2 hours', 7200], ['minutes 90 seconds', 90], ['seconds 45', 45],
  ['minutes 0', 1], ['minutes 99999', 86400], ['minutes soon', 300], ['', 300],
])('duration from %j is %i seconds', (line, seconds) => expect(timer(line).seconds).toBe(seconds));

test('count defaults on, and the label falls back to the app name', () => {
  expect(timer('name Tea Timer')).toMatchObject({ count: true, label: 'Tea Timer', name: 'Tea Timer' });
  expect(timer('count no').count).toBe(false);
});

describe('log day fields', () => {
  const log = (reply: string) => parseLog(readSettings(reply), 'Task list');
  test('deadline-like keys and the day type are typed dates; entry dates stay stamped', () => {
    const c = log('field task text Task\nfield due date Due date\nfield added date Added\nfield birthday day Birthday');
    expect(c.fields.map((f) => `${f.key}:${f.type}`)).toEqual(['task:text', 'due:day', 'added:date', 'birthday:day']);
  });
});
