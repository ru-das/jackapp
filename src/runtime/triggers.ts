import { cancelTriggers, ensurePermission, scheduleTriggers, toast } from '@/capabilities';
import { planSchedule, type ScheduledTrigger } from '@/capabilities/notificationPlan';
import type { Spec } from '@/spec/types';
import { resolveTemplate } from '@/spec/values';

/**
 * Schedules a mini-app's triggers (SCHEMA §8): the notification text is evaluated now, not when it fires, so keep it stable.
 * Replaces whatever was scheduled for the app. Called every time the app is opened, which always follows a save.
 * Returns how many reminders are set; 0 with `denied` when the user turned notifications off.
 */
export async function syncTriggers(appId: string, spec: Spec, state: Readonly<Record<string, unknown>>, now = new Date()): Promise<{ scheduled: number; denied: boolean }> {
  const context = { state, now, locale: Intl.DateTimeFormat().resolvedOptions().locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const planned: ScheduledTrigger[] = (spec.triggers ?? []).flatMap((trigger) => {
    const plan = planSchedule(trigger.schedule, now);
    return plan ? [{ id: trigger.id, plan, title: resolveTemplate(trigger.notify.title, context), body: resolveTemplate(trigger.notify.body, context) }] : [];
  });
  if (!planned.length) { await cancelTriggers(appId); return { scheduled: 0, denied: false }; }
  if (!(await ensurePermission())) {
    await cancelTriggers(appId);
    toast('Notifications are off, so this mini-app’s reminders will not show.');
    return { scheduled: 0, denied: true };
  }
  await scheduleTriggers(appId, planned);
  return { scheduled: planned.length, denied: false };
}

export { cancelTriggers };
