import type { Spec } from '@/spec/types';
import { fieldLabel, inline, joinWords as join } from './labels';

// The preview text comes from the spec JackApp built, never from the model's own claim about it (T-98).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const strings = (values: unknown[]) => values.filter((v): v is string => typeof v === 'string' && v.length > 0 && !v.includes('{{'));
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

export function describeSpec(spec: Spec): string {
  // Only the first screen: a second screen is a detail view and would repeat the same labels.
  const reach = (id: string): string[] => [id, ...(spec.elements[id]?.children ?? []).flatMap(reach)];
  const els = reach(spec.screens[0].root).map((id) => spec.elements[id]).filter(Boolean);
  const props = (type: string) => els.filter((e) => e.type === type).map((e) => e.props as Record<string, unknown>);
  const steps = Object.values(spec.actions).flatMap((a) => a.steps);
  const out: string[] = [];

  const lists = props('List');
  const listState = Object.values(spec.state).find((d) => d.type === 'list');
  if (lists.length && listState && 'of' in listState) {
    const flags = new Set(lists.map((l) => l.flagField));
    const fields = Object.keys(listState.of as object).filter((k) => k !== 'done' && !flags.has(k)).map((k) => inline(fieldLabel(spec, k)));
    out.push(`Keeps a list${fields.length ? ` with ${join(fields)}` : ''}.`);
    if (lists.some((l) => l.checkField)) out.push('Tick items off.');
    const tap = lists.find((l) => l.onItemPress)?.onItemPress as string | undefined;
    const tapSteps = tap ? spec.actions[tap]?.steps ?? [] : [];
    const set = (tapSteps.find((s) => s.op === 'state.update') as { set?: Record<string, unknown> } | undefined)?.set;
    const go = tapSteps.find((s) => s.op === 'navigate') as { screen?: string } | undefined;
    if (go) {
      const target = spec.screens.find((sc) => sc.id === go.screen);
      const dated = target && reach(target.root).some((id) => spec.elements[id]?.type === 'DateInput');
      out.push(dated ? 'Tap an entry to record or fix the date.' : 'Tap an entry to edit it.');
    } else if (set) out.push(Object.values(set).some((v) => v && typeof v === 'object' && '$math' in v) ? 'Tap an entry to add 1.' : 'Tap an entry to record the date.');
  }
  const inputs = strings([...props('TextInput'), ...props('NumberInput'), ...props('DateInput'), ...props('Select'), ...props('ImageInput')].map((p) => p.label)).map(inline);
  if (inputs.length) out.push(`You enter ${join(inputs)}.`);
  const timer = props('Timer')[0];
  if (timer && typeof timer.seconds === 'number') out.push(`Counts down ${timer.seconds % 60 === 0 ? plural(timer.seconds / 60, 'minute') : plural(timer.seconds, 'second')}.`);
  if (steps.some((s) => s.op === 'ai.run')) out.push('The AI reads your input and writes the result.');
  const stats = strings(props('Stat').map((p) => p.label)).map(inline);
  if (stats.length) out.push(`Shows ${join(stats)}.`);
  if (steps.some((s) => s.op === 'state.diff')) out.push('It compares what the photo shows with your usual items.');
  if (steps.some((s) => s.op === 'state.increment' && s.path === 'count')) out.push('A button adds to the count.');
  for (const t of spec.triggers ?? []) {
    const s = t.schedule;
    if (s.kind === 'daily') out.push(`Reminds you every day at ${s.time}.`);
    else if (s.kind === 'weekly') out.push(`Reminds you every ${DAYS[s.weekday]} at ${s.time}.`);
    else out.push('Reminds you once.');
  }
  if (steps.some((s) => s.op === 'share')) out.push('You can share it.');
  return out.join(' ') || 'A simple mini-app.';
}

/** Things the request names that this spec does not do. Keyword checks: they can miss, but a hit is reliable. */
export function omissions(request: string, spec: Spec): string[] {
  const has = (re: RegExp) => re.test(request);
  const elements = Object.values(spec.elements);
  const out: string[] = [];
  if (has(/\b(remind\w*|notif\w*|alarm|alert)\b/i) && !spec.triggers?.length) out.push('Reminders aren’t part of this mini-app.');
  if (has(/\b(photo|photos|picture|camera|scan)\b/i) && !elements.some((e) => e.type === 'ImageInput')) out.push('Photos aren’t part of this mini-app.');
  if (has(/\b(charts?|graphs?|plots?)\b/i)) out.push('Charts aren’t part of this mini-app.');
  return out;
}
