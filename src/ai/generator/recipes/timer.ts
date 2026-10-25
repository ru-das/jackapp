import { assemble, ref, tree, type Obj } from './kit';
import { cleanText, first, flag, icon, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type TimerConfig = { name: string; icon: string; description: string; label: string; seconds: number; count: boolean };

export function buildTimer(c: TimerConfig): Obj {
  const t = tree();
  const timer = t.add('Timer', { seconds: c.seconds, label: c.label, onDone: 'finished' });
  const kids = [timer];
  if (c.count) {
    kids.push(t.add('Stat', { label: 'Times finished', value: ref('finished'), format: 'number' }));
    kids.push(t.add('Button', { label: 'Reset count', onPress: 'resetCount', variant: 'secondary' }));
  }
  const card = t.add('Card', { title: c.name }, kids);
  const root = t.add('Stack', { gap: 'md' }, [card]);
  return assemble({ name: c.name, description: c.description, icon: c.icon },
    c.count ? { finished: { type: 'number', default: 0 } } : {}, root, t.elements, {
      finished: { steps: [...(c.count ? [{ op: 'state.increment', path: 'finished', by: 1 }] : []), { op: 'toast', message: `${c.label}: time’s up.` }] },
      ...(c.count ? { resetCount: { steps: [{ op: 'state.reset', path: 'finished' }] } } : {}),
    });
}

/** "25", "25 min", "1 hour 30", "90 seconds": the settings reply gives a duration in minutes or seconds. */
function duration(s: Settings, notes: string[]): number {
  const minutes = first(s, 'minutes') ?? first(s, 'minute') ?? first(s, 'duration');
  const seconds = first(s, 'seconds') ?? first(s, 'second');
  const num = (text: string | undefined) => { const m = /\d+(?:\.\d+)?/.exec(text ?? ''); return m ? Number(m[0]) : undefined; };
  const unitIsSeconds = !minutes && seconds !== undefined;
  const value = num(minutes ?? seconds);
  if (value === undefined) { notes.push('No length was given, so it counts down 5 minutes.'); return 5 * 60; }
  const fromText = /\bsec/i.test(minutes ?? '') ? value : /\bhour|\bhr/i.test(minutes ?? '') ? value * 3600 : unitIsSeconds ? value : value * 60;
  return Math.min(24 * 3600, Math.max(1, Math.round(fromText)));
}

export function parseTimer(s: Settings, request: string, notes: string[] = []): TimerConfig {
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  return {
    name, icon: icon(first(s, 'icon'), '⏱️'), description: cleanText(first(s, 'description'), 140, `${name}: a countdown`),
    label: cleanText(first(s, 'label'), 30, name), seconds: duration(s, notes), count: flag(first(s, 'count'), true),
  };
}

export const timerRecipe: Recipe = {
  id: 'timer', version: 1, title: 'Timer', hint: 'a countdown timer with start, pause and reset: Pomodoro, cooking, workouts, tea',
  summary: 'A countdown timer the user starts, pauses and resets. It can count how many times it finished.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
label <what is being timed, e.g. Focus>
minutes <length of the countdown in minutes>   (or: seconds <number>)
count <yes|no>   (count how many times the timer finished)`,
  example: {
    request: 'Pomodoro timer',
    reply: `name Pomodoro
icon 🍅
description 25 minute focus sessions
label Focus
minutes 25
count yes`,
  },
  make: (s, request, notes) => buildTimer(parseTimer(s, request, notes)),
};
