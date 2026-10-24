import { assemble, ref, tree, type Obj } from './kit';
import { cleanText, first, icon, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type CounterConfig = { name: string; icon: string; description: string; noun: string; step: number };

export function buildCounter(c: CounterConfig): Obj {
  const t = tree();
  const stat = t.add('Stat', { label: c.noun[0].toUpperCase() + c.noun.slice(1), value: ref('count'), format: 'number' });
  const add = t.add('Button', { label: c.step === 1 ? 'Add one' : `Add ${c.step}`, onPress: 'add', variant: 'primary' });
  const reset = t.add('Button', { label: 'Reset', onPress: 'reset', variant: 'secondary' });
  const card = t.add('Card', { title: c.name }, [stat, add, reset]);
  const root = t.add('Stack', { gap: 'md' }, [card]);
  return assemble({ name: c.name, description: c.description, icon: c.icon }, { count: { type: 'number', default: 0 } }, root, t.elements, {
    add: { steps: [{ op: 'state.increment', path: 'count', by: c.step }] },
    reset: { steps: [{ op: 'confirm', message: 'Reset the count to zero?' }, { op: 'state.reset', path: 'count' }] },
  });
}

export function parseCounter(s: Settings, request: string): CounterConfig {
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  const noun = cleanText(first(s, 'noun'), 24, 'count').toLowerCase();
  const step = Math.min(100, Math.max(1, Math.round(Number(/\d+/.exec(first(s, 'step') ?? '')?.[0] ?? 1)) || 1));
  return { name, icon: icon(first(s, 'icon'), '🔢'), description: cleanText(first(s, 'description'), 140, `Count ${noun}`), noun, step };
}

export const counterRecipe: Recipe = {
  id: 'counter', title: 'Counter',
  summary: 'A number that goes up by a fixed step with one button and can be reset.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
noun <what is counted, e.g. glasses>
step <whole number added per press, usually 1>`,
  example: {
    request: 'Count glasses of water with an add one button and a reset button.',
    reply: `name Water Counter
icon 💧
description Count the glasses of water you drink
noun glasses
step 1`,
  },
  make: (s, request) => buildCounter(parseCounter(s, request)),
};
