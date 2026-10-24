import { createActionEngine } from '@/runtime/actions';
import type { Spec } from '@/spec/types';
import { resolveTemplate, resolveValue } from '@/spec/values';

/** Checks find elements by their visible label, never by id, so any valid spec for the request can pass. */
type Scalar = string | number | boolean;
export type CheckStep =
  | { fill: Record<string, Scalar> }
  | { press: string; row?: number }
  | { expectStat: string; equals: number | string }
  | { expectRow: Scalar[] };
export type Check = { layer: 'behaviour' | 'intent'; steps: CheckStep[] };
export type CheckResult = { layer: Check['layer']; passed: boolean; reason?: string };

const INPUTS = ['TextInput', 'NumberInput', 'Toggle', 'Select', 'DateInput'];
const matcher = (pattern: string) => new RegExp(pattern, 'i');
const numbers = (text: string) => (text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

function run(spec: Spec, check: Check, now: Date): Promise<string | undefined> {
  const today = now.toISOString().slice(0, 10);
  let state: Record<string, unknown> = Object.fromEntries(Object.entries(spec.state).map(([k, d]) => [k, structuredClone(d.default)]));
  let toasted = '';
  const base = { now, locale: 'en-US', timeZone: 'UTC', currency: 'USD' };
  const engine = createActionEngine({
    spec,
    store: { getState: () => state, setState: (next) => { state = { ...state, ...(typeof next === 'function' ? next(state) : next) }; } },
    services: {
      share: () => {}, confirm: () => true, navigate: () => {}, notify: () => {},
      toast: (m) => { toasted = m; },
      // Behaviour checks never call the model; an app that needs it fails here, visibly.
      ai: () => { throw new Error('ai.run is not available in behaviour checks'); },
    },
    getValueContext: () => base,
  });
  const elements = Object.values(spec.elements);
  const text = (value: unknown) => resolveTemplate(String(value ?? ''), { ...base, state });
  const labelled = (types: string[], pattern: string, prop = 'label') =>
    elements.find((e) => types.includes(e.type) && matcher(pattern).test(text(e.props[prop])));
  const same = (got: unknown, want: unknown) => {
    if (typeof got === 'number' && typeof want === 'number') return Math.abs(got - want) < 0.01;
    if (typeof got !== 'string' || typeof want !== 'string') return got === want;
    return /^\d{4}-\d\d-\d\d/.test(want) ? got.slice(0, 10) === want.slice(0, 10) : got.toLowerCase() === want.toLowerCase();
  };

  return (async () => {
    for (const step of check.steps) {
      if ('fill' in step) {
        for (const [pattern, value] of Object.entries(step.fill)) {
          const input = labelled(INPUTS, pattern);
          if (!input) return `no input labelled /${pattern}/`;
          const key = input.props.bind as string;
          const type = spec.state[key]?.type;
          const wanted = value === '$today' ? today : value;
          if ((type === 'number') !== (typeof wanted === 'number')) return `input /${pattern}/ takes a ${type}, check gives ${typeof wanted}`;
          state = { ...state, [key]: wanted };
        }
      } else if ('press' in step) {
        toasted = '';
        if (step.row === undefined) {
          const button = labelled(['Button'], step.press);
          if (!button) return `no button labelled /${step.press}/`;
          await engine.run(button.props.onPress as string);
        } else {
          const list = elements.find((e) => e.type === 'List' && typeof e.props.onItemPress === 'string');
          const rows = list ? state[list.props.items as string] : undefined;
          if (!list || !Array.isArray(rows) || !rows[step.row]) return `no list row ${step.row} to press`;
          await engine.run(list.props.onItemPress as string, { item: rows[step.row], index: step.row });
        }
        if (toasted) return `pressing /${step.press}/ failed (${toasted})`;
      } else if ('expectStat' in step) {
        const ctx = { ...base, state };
        const stat = labelled(['Stat'], step.expectStat);
        const shown = stat ? resolveValue(stat.props.value as never, ctx) : undefined;
        const near = (n: number) => typeof step.equals === 'number' && Math.abs(n - step.equals) < 0.01;
        if (stat && (typeof shown === 'number' ? near(shown) : String(shown) === String(step.equals))) continue;
        // A total shown in a Text line counts too.
        const line = elements.find((e) => e.type === 'Text' && matcher(step.expectStat).test(text(e.props.value))
          && numbers(text(e.props.value)).some(near));
        if (!line) return stat ? `/${step.expectStat}/ shows ${String(shown)}, expected ${step.equals}` : `no total labelled /${step.expectStat}/`;
      } else {
        const found = Object.values(state).some((list) => Array.isArray(list) && list.some((row) =>
          step.expectRow.every((want) => Object.values(row).some((got) => same(got, want === '$today' ? today : want)))));
        if (!found) return `no row containing ${JSON.stringify(step.expectRow)}`;
      }
    }
    return undefined;
  })();
}

/** Runs each check on a fresh copy of the app's initial state. A check never throws; a crash is a failed check. */
export async function runChecks(spec: Spec, checks: readonly Check[], now = new Date('2026-10-21T09:00:00Z')): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      const reason = await run(spec, check, now);
      results.push(reason ? { layer: check.layer, passed: false, reason } : { layer: check.layer, passed: true });
    } catch (error) {
      results.push({ layer: check.layer, passed: false, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
