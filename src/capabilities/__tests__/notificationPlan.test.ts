import { nextFire, notificationId, planSchedule } from '../notificationPlan';

const now = new Date(2026, 9, 25, 10, 0, 0); // Sunday 25 Oct 2026, 10:00 local

describe('planSchedule', () => {
  test('daily and weekly map to the native conventions (weekday 1 = Sunday)', () => {
    expect(planSchedule({ kind: 'daily', time: '08:30' }, now)).toEqual({ type: 'daily', hour: 8, minute: 30 });
    expect(planSchedule({ kind: 'weekly', weekday: 0, time: '09:00' }, now)).toEqual({ type: 'weekly', weekday: 1, hour: 9, minute: 0 });
    expect(planSchedule({ kind: 'weekly', weekday: 6, time: '23:59' }, now)).toEqual({ type: 'weekly', weekday: 7, hour: 23, minute: 59 });
  });
  test('once is kept only when it is still in the future', () => {
    expect(planSchedule({ kind: 'once', at: '2026-12-25T09:00:00Z' }, now)).toEqual({ type: 'once', at: new Date('2026-12-25T09:00:00Z') });
    expect(planSchedule({ kind: 'once', at: '2026-01-01T09:00:00Z' }, now)).toBeUndefined();
    expect(planSchedule({ kind: 'once', at: 'not a date' }, now)).toBeUndefined();
  });
  test.each(['24:00', '12:60', '9:00', 'noon', ''])('a clock of %j cannot fire', (time) => {
    expect(planSchedule({ kind: 'daily', time }, now)).toBeUndefined();
  });
});

describe('nextFire', () => {
  test('daily fires today if the time is still ahead, otherwise tomorrow', () => {
    expect(nextFire({ type: 'daily', hour: 18, minute: 0 }, now)).toEqual(new Date(2026, 9, 25, 18, 0));
    expect(nextFire({ type: 'daily', hour: 8, minute: 0 }, now)).toEqual(new Date(2026, 9, 26, 8, 0));
  });
  test('weekly finds the next matching weekday, and a passed time today waits a week', () => {
    expect(nextFire({ type: 'weekly', weekday: 3, hour: 7, minute: 0 }, now)).toEqual(new Date(2026, 9, 27, 7, 0)); // Tuesday
    expect(nextFire({ type: 'weekly', weekday: 1, hour: 9, minute: 0 }, now)).toEqual(new Date(2026, 10, 1, 9, 0)); // Sunday already passed
    expect(nextFire({ type: 'weekly', weekday: 1, hour: 11, minute: 0 }, now)).toEqual(new Date(2026, 9, 25, 11, 0));
  });
  test('once is just its date', () => {
    const at = new Date('2026-12-25T09:00:00Z');
    expect(nextFire({ type: 'once', at }, now)).toBe(at);
  });
});

test('ids are stable per app and trigger, and an app prefix matches only its own', () => {
  expect(notificationId('app-1', 'water')).toBe('jackapp:app-1:water');
  expect(notificationId('app-1', 'water').startsWith(notificationId('app-1', ''))).toBe(true);
  expect(notificationId('app-12', 'water').startsWith(notificationId('app-1', ''))).toBe(false);
});
