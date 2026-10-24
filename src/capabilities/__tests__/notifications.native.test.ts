import { cancelTriggers, ensurePermission, notifyNow, onNotificationOpen, scheduleTriggers } from '../notifications.native';
// The factory runs when the module under test is imported, so everything it needs is built inside it.
jest.mock('expo-notifications', () => {
  const scheduled: { identifier?: string; content: unknown; trigger: unknown }[] = [];
  const state: { listener?: (r: unknown) => void } = {};
  return {
    scheduled, state,
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => {}),
    getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    scheduleNotificationAsync: jest.fn(async (r: { identifier?: string; content: unknown; trigger: unknown }) => { scheduled.push(r); return r.identifier ?? 'id'; }),
    getAllScheduledNotificationsAsync: jest.fn(async () => scheduled.map((s) => ({ identifier: s.identifier ?? '' }))),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => { const at = scheduled.findIndex((s) => s.identifier === id); if (at >= 0) scheduled.splice(at, 1); }),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    addNotificationResponseReceivedListener: jest.fn((fn: (r: unknown) => void) => { state.listener = fn; return { remove: jest.fn() }; }),
  };
});


const mock = jest.requireMock('expo-notifications');
const scheduled: { identifier?: string; content: unknown; trigger: unknown }[] = mock.scheduled;
beforeEach(() => { scheduled.length = 0; jest.clearAllMocks(); mock.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true }); });

test('permission is requested once, and not again after a refusal that cannot be re-asked', async () => {
  expect(await ensurePermission()).toBe(true);
  expect(mock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  mock.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await ensurePermission()).toBe(false);
  expect(mock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('scheduling replaces the app’s old reminders and leaves other apps alone', async () => {
  await scheduleTriggers('other', [{ id: 'a', plan: { type: 'daily', hour: 7, minute: 0 }, title: 'T', body: 'B' }]);
  await scheduleTriggers('app-1', [{ id: 'old', plan: { type: 'daily', hour: 8, minute: 0 }, title: 'Old', body: 'x' }]);
  await scheduleTriggers('app-1', [
    { id: 'water', plan: { type: 'weekly', weekday: 1, hour: 9, minute: 5 }, title: 'Plant Pal 🌱', body: 'Water them' },
    { id: 'once', plan: { type: 'once', at: new Date('2026-12-25T09:00:00Z') }, title: 'Xmas', body: 'Hi' },
  ]);
  expect(scheduled.map((s) => s.identifier).sort()).toEqual(['jackapp:app-1:once', 'jackapp:app-1:water', 'jackapp:other:a']);
  expect(scheduled.find((s) => s.identifier === 'jackapp:app-1:water')).toMatchObject({
    content: { title: 'Plant Pal 🌱', body: 'Water them', data: { appId: 'app-1' } },
    trigger: { type: 'weekly', weekday: 1, hour: 9, minute: 5, channelId: 'reminders' } });
  expect(scheduled.find((s) => s.identifier === 'jackapp:app-1:once')?.trigger).toMatchObject({ type: 'date', date: new Date('2026-12-25T09:00:00Z') });
  await cancelTriggers('app-1');
  expect(scheduled.map((s) => s.identifier)).toEqual(['jackapp:other:a']);
});

test('notify now needs permission and fires immediately', async () => {
  await notifyNow({ title: 'Done', body: 'Tea is ready' });
  expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith({ content: { title: 'Done', body: 'Tea is ready' }, trigger: null });
  mock.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
  await expect(notifyNow({ title: 'x', body: 'y' })).rejects.toThrow('turned off');
});

test('tapping a reminder reports the app id; foreign notifications are ignored', async () => {
  const open = jest.fn();
  const stop = onNotificationOpen(open);
  mock.state.listener?.({ notification: { request: { content: { data: { appId: 'app-9' } } } } });
  mock.state.listener?.({ notification: { request: { content: { data: {} } } } });
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith('app-9');
  stop();
});
