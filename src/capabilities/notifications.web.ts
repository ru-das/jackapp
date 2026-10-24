import { nextFire, notificationId, type ScheduledTrigger } from './notificationPlan';
import { toast } from './toast';

// shortcut: browsers cannot schedule notifications while the page is closed, so reminders fire only while JackApp is open in a tab.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const supported = () => typeof Notification !== 'undefined';

export async function ensurePermission(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notifyNow(message: { title: string; body: string }): Promise<void> {
  if (supported() && Notification.permission === 'granted') new Notification(message.title, { body: message.body });
  else toast(`${message.title}: ${message.body}`);
}

export async function cancelTriggers(appId: string): Promise<void> {
  const prefix = notificationId(appId, '');
  for (const [key, timer] of timers) if (key.startsWith(prefix)) { clearTimeout(timer); timers.delete(key); }
}

export async function scheduleTriggers(appId: string, triggers: ScheduledTrigger[]): Promise<void> {
  await cancelTriggers(appId);
  for (const { id, plan, title, body } of triggers) {
    const key = notificationId(appId, id);
    const arm = () => {
      // setTimeout caps near 24.8 days; a later fire re-arms itself when the page is reopened.
      const wait = Math.min(nextFire(plan, new Date()).getTime() - Date.now(), 2 ** 31 - 1);
      timers.set(key, setTimeout(() => {
        void notifyNow({ title, body });
        if (plan.type !== 'once') arm(); else timers.delete(key);
      }, Math.max(wait, 0)));
    };
    arm();
  }
}

// A browser notification focuses the open tab; there is no cold start to handle.
export function onNotificationOpen(_open: (appId: string) => void): () => void {
  return () => {};
}
