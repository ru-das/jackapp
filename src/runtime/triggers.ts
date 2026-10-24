import { cancelTriggers, ensurePermission, isSupported, scheduleTest, scheduleTriggers } from '@/capabilities';
import { nextFire, planSchedule, type ScheduledTrigger } from '@/capabilities/notificationPlan';
import type { Spec } from '@/spec/types';
import { resolveTemplate } from '@/spec/values';

export type ReminderStatus = 'none' | 'on' | 'denied' | 'unavailable';
export type SyncResult = { scheduled: number; denied: boolean; status: ReminderStatus; next?: Date; test?: { title: string; body: string } };

/**
 * Schedules a mini-app's triggers (SCHEMA §8): the notification text is evaluated now, not when it fires, so keep it stable.
 * Replaces whatever was scheduled for the app. Called every time the app is opened, which always follows a save.
 * `status` is what the run screen shows; `test` is the first reminder's text, for the "send a test" button.
 */
export async function syncTriggers(appId: string, spec: Spec, state: Readonly<Record<string, unknown>>, now = new Date()): Promise<SyncResult> {
  const context = { state, now, locale: Intl.DateTimeFormat().resolvedOptions().locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const planned: ScheduledTrigger[] = (spec.triggers ?? []).flatMap((trigger) => {
    const plan = planSchedule(trigger.schedule, now);
    return plan ? [{ id: trigger.id, plan, title: resolveTemplate(trigger.notify.title, context), body: resolveTemplate(trigger.notify.body, context) }] : [];
  });
  if (!planned.length) { await cancelTriggers(appId); return { scheduled: 0, denied: false, status: 'none' }; }
  const test = { title: planned[0].title, body: planned[0].body };
  if (!isSupported()) return { scheduled: 0, denied: false, status: 'unavailable' };
  try {
    if (!(await ensurePermission())) {
      await cancelTriggers(appId);
      return { scheduled: 0, denied: true, status: 'denied' };
    }
    await scheduleTriggers(appId, planned);
  } catch (e) {
    console.warn(`reminders unavailable for ${appId}`, e); // e.g. a dev build without the native module
    return { scheduled: 0, denied: false, status: 'unavailable' };
  }
  const next = new Date(Math.min(...planned.map((p) => nextFire(p.plan, now).getTime())));
  return { scheduled: planned.length, denied: false, status: 'on', next, test };
}

/** Schedules the one-off check; returns when it will arrive. */
export const sendTestReminder = (appId: string, message: { title: string; body: string }) => scheduleTest(appId, message, 2);

export { cancelTriggers };
