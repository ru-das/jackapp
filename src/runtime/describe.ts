import type { Spec } from '@/spec/types';

// The preview text comes from the spec JackApp built, never from the model's own claim about it (T-98).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const human = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const join = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const strings = (values: unknown[]) => values.filter((v): v is string => typeof v === 'string' && v.length > 0 && !v.includes('{{'));

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
    const fields = Object.keys(listState.of as object).filter((k) => k !== 'done').map(human);
    out.push(`Keeps a list${fields.length ? ` with ${join(fields)}` : ''}.`);
    if (lists.some((l) => l.checkField)) out.push('Tick items off.');
    const tap = lists.find((l) => l.onItemPress)?.onItemPress as string | undefined;
    const tapSteps = tap ? spec.actions[tap]?.steps ?? [] : [];
    const set = (tapSteps.find((s) => s.op === 'state.update') as { set?: Record<string, unknown> } | undefined)?.set;
    if (tapSteps.some((s) => s.op === 'navigate')) out.push('Tap an item to record or fix the date.');
    else if (set) out.push(Object.values(set).some((v) => v && typeof v === 'object' && '$math' in v) ? 'Tap an item to add 1.' : 'Tap an item to record the date.');
  }
  const inputs = strings([...props('TextInput'), ...props('NumberInput'), ...props('DateInput'), ...props('Select'), ...props('ImageInput')].map((p) => p.label));
  if (inputs.length) out.push(`You enter ${join(inputs)}.`);
  const timer = props('Timer')[0];
  if (timer && typeof timer.seconds === 'number') out.push(`Counts down ${timer.seconds % 60 === 0 ? `${timer.seconds / 60} min` : `${timer.seconds} s`}.`);
  if (steps.some((s) => s.op === 'ai.run')) out.push('The AI reads your input and writes the result.');
  const stats = strings(props('Stat').map((p) => p.label));
  if (stats.length) out.push(`Shows ${join(stats)}.`);
  if (steps.some((s) => s.op === 'state.increment')) out.push('A button adds to the count.');
  for (const t of spec.triggers ?? []) {
    const s = t.schedule;
    if (s.kind === 'daily') out.push(`Reminds you every day at ${s.time}.`);
    else if (s.kind === 'weekly') out.push(`Reminds you every ${DAYS[s.weekday]} at ${s.time}.`);
    else out.push('Reminds you once.');
  }
  if (steps.some((s) => s.op === 'share')) out.push('You can share it.');
  return out.join(' ') || 'A small mini-app.';
}

/** Things the request names that this spec does not do. Keyword checks: they can miss, but a hit is reliable. */
export function omissions(request: string, spec: Spec): string[] {
  const has = (re: RegExp) => re.test(request);
  const elements = Object.values(spec.elements);
  const out: string[] = [];
  if (has(/\b(remind\w*|notif\w*|alarm|alert)\b/i) && !spec.triggers?.length) out.push('Reminders aren’t in this app.');
  if (has(/\b(photo|photos|picture|camera|scan)\b/i) && !elements.some((e) => e.type === 'ImageInput')) out.push('Photos aren’t in this app.');
  if (has(/\b(charts?|graphs?|plots?)\b/i)) out.push('Charts aren’t available in this build.');
  return out;
}
