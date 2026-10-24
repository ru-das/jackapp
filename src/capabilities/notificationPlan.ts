import type { Schedule } from '@/spec/types';

/** Platform-neutral description of when a trigger fires; the .native and .web files turn it into real notifications. */
export type Plan =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number } // weekday 1–7, Sunday = 1 (the native convention)
  | { type: 'once'; at: Date };

const clock = (time: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  const hour = m ? Number(m[1]) : NaN;
  const minute = m ? Number(m[2]) : NaN;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : undefined;
};

/** Spec weekdays are 0 = Sunday … 6 = Saturday. Returns undefined for a time that cannot fire (bad clock, or a `once` already in the past). */
export function planSchedule(schedule: Schedule, now: Date): Plan | undefined {
  if (schedule.kind === 'once') {
    const at = new Date(schedule.at);
    return Number.isFinite(at.getTime()) && at.getTime() > now.getTime() ? { type: 'once', at } : undefined;
  }
  const time = clock(schedule.time);
  if (!time) return undefined;
  return schedule.kind === 'daily' ? { type: 'daily', ...time } : { type: 'weekly', weekday: schedule.weekday + 1, ...time };
}

export type ScheduledTrigger = { id: string; plan: Plan; title: string; body: string };

/** Stable per-app, per-trigger identifier so a re-sync replaces instead of duplicating. */
export const notificationId = (appId: string, triggerId: string) => `jackapp:${appId}:${triggerId}`;

export const testId = (appId: string) => notificationId(appId, 'test');

/** The next time a plan fires after `now`; the web fallback uses it to set a timer. */
export function nextFire(plan: Plan, now: Date): Date {
  if (plan.type === 'once') return plan.at;
  const next = new Date(now);
  next.setHours(plan.hour, plan.minute, 0, 0);
  if (plan.type === 'weekly') next.setDate(next.getDate() + ((plan.weekday - 1 - next.getDay() + 7) % 7));
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + (plan.type === 'daily' ? 1 : 7));
  return next;
}
