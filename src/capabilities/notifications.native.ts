import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { notificationId, testId, type ScheduledTrigger } from './notificationPlan';

const CHANNEL = 'reminders';
let ready = false;

async function setup() {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: AndroidImportance.HIGH });
}

/** Asks once; true when reminders can show. */
export async function ensurePermission(): Promise<boolean> {
  await setup();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces everything scheduled for this app; the triggers' templates are already evaluated. */
export async function scheduleTriggers(appId: string, triggers: ScheduledTrigger[]): Promise<void> {
  await setup();
  await cancelFor(appId, testId(appId)); // a pending "test in 2 minutes" survives a re-sync
  const T = Notifications.SchedulableTriggerInputTypes;
  for (const { id, plan, title, body } of triggers) {
    const trigger = plan.type === 'daily' ? { type: T.DAILY, hour: plan.hour, minute: plan.minute, channelId: CHANNEL } as const
      : plan.type === 'weekly' ? { type: T.WEEKLY, weekday: plan.weekday, hour: plan.hour, minute: plan.minute, channelId: CHANNEL } as const
        : { type: T.DATE, date: plan.at, channelId: CHANNEL } as const;
    await Notifications.scheduleNotificationAsync({ identifier: notificationId(appId, id), content: { title, body, data: { appId } }, trigger });
  }
}

async function cancelFor(appId: string, keep?: string): Promise<void> {
  const prefix = notificationId(appId, '');
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(prefix) && n.identifier !== keep).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export const cancelTriggers = (appId: string) => cancelFor(appId);

export const isSupported = () => true;

/** One-off copy of a reminder a few minutes ahead, so the user can check delivery without waiting for Sunday. */
export async function scheduleTest(appId: string, message: { title: string; body: string }, minutes = 2): Promise<Date> {
  await setup();
  const at = new Date(Date.now() + minutes * 60_000);
  await Notifications.scheduleNotificationAsync({ identifier: testId(appId), content: { ...message, data: { appId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL } });
  return at;
}

export async function notifyNow(message: { title: string; body: string }): Promise<void> {
  await setup();
  if (!(await ensurePermission())) throw new Error('Notifications are turned off for this app.');
  await Notifications.scheduleNotificationAsync({ content: message, trigger: null });
}

/** Calls `open` with the mini-app id when the user taps one of our notifications (also for the tap that launched the app). */
export function onNotificationOpen(open: (appId: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null | undefined) => {
    const appId = response?.notification.request.content.data?.appId;
    if (typeof appId === 'string') open(appId);
  };
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
