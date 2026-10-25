import { StateDeclSchema } from '@/spec/schema';
import type { ActionStep, Spec, Value } from '@/spec/types';
import { resolveTemplate, resolveValue, type ValueContext } from '@/spec/values';
import type { Store } from './store';

type MaybePromise<T> = T | Promise<T>;
type AiStep = Extract<ActionStep, { op: 'ai.run' }>;
export type ResolvedAiStep = Omit<AiStep, 'image'> & { image?: unknown };
/** An error whose message is already short and safe to show the user as a toast. */
export class FriendlyError extends Error {}
export interface ActionServices {
  share(text: string): MaybePromise<void>;
  toast(message: string): MaybePromise<void>;
  confirm(message: string): MaybePromise<boolean>;
  navigate(screen: string): MaybePromise<void>;
  notify?(message: { title: string; body: string }): MaybePromise<void>;
  /** The adapter owns inference, output validation, defaults and state writes. */
  ai?(step: ResolvedAiStep): MaybePromise<void>;
}
export interface ActionInvocation {
  item?: Readonly<Record<string, unknown>>;
  index?: number;
}
export interface ActionEngineOptions {
  spec: Spec;
  store: Pick<Store, 'getState' | 'setState'>;
  services: ActionServices;
  getValueContext(): Omit<ValueContext, 'state' | 'item' | 'index'>;
}

/** Executes a semantically validated, parsed spec. */
/** Lowercase, trimmed, one trailing "s" dropped, so "Eggs" and "egg" are the same thing. */
const sameThing = (value: unknown) => String(value ?? '').toLowerCase().trim().replace(/s$/, '');
// ponytail: substring match ("milk" ~ "oat milk"), swap for a synonym table if "yogurt"/"yoghurt" misses matter.
const matches = (a: string, b: string) => a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));

export function createActionEngine({ spec, store, services, getValueContext }: ActionEngineOptions) {
  const busy = new Set<string>();
  const listeners = new Set<() => void>();
  function emit() {
    listeners.forEach((listener) => {
      try { listener(); } catch (error) { console.error('Action subscriber failed', error); }
    });
  }

  function changeState(step: Extract<ActionStep, { path: string }>, context: ValueContext) {
    const { path } = step;
    const declaration = spec.state[path];
    if (!declaration) throw new Error(`Undeclared state: ${path}`);
    const current = context.state[path];
    const value = (input: Value) => resolveValue(input, context);
    const fields = (input: Record<string, Value>) => Object.fromEntries(
      Object.entries(input).map(([key, inputValue]) => [key, value(inputValue)]),
    );
    const list = () => {
      if (declaration.type !== 'list' || !Array.isArray(current)) throw new Error(`Expected list: ${path}`);
      return current as Record<string, unknown>[];
    };
    const index = (input: Value, length: number) => {
      const resolved = value(input);
      if (typeof resolved !== 'number' || !Number.isInteger(resolved) || resolved < 0 || resolved >= length) {
        throw new Error(`Invalid index for ${path}: ${String(resolved)}`);
      }
      return resolved;
    };
    let candidate: unknown;
    switch (step.op) {
      case 'state.set': candidate = value(step.value); break;
      case 'state.append': {
        const item = fields(step.value);
        for (const key of step.required ?? []) {
          if (typeof item[key] !== 'string' || item[key].trim() === '') throw new FriendlyError(`Fill in the ${key} first.`);
        }
        candidate = [...list(), item]; break;
      }
      case 'state.update': {
        const rows = list();
        const at = index(step.index, rows.length);
        const patch = fields(step.set);
        candidate = rows.map((row, i) => i === at ? { ...row, ...patch } : row);
        break;
      }
      case 'state.remove': {
        const rows = list();
        if (step.index !== undefined) {
          const at = index(step.index, rows.length);
          candidate = rows.filter((_, i) => i !== at);
        } else {
          const where = step.where!;
          candidate = rows.filter((row) => row[where.field] !== where.equals);
        }
        break;
      }
      case 'state.toggle':
        if (typeof current !== 'boolean') throw new Error(`Expected boolean: ${path}`);
        candidate = !current;
        break;
      case 'state.increment': {
        const by = value(step.by);
        if (typeof current !== 'number' || typeof by !== 'number' || !Number.isFinite(by)) {
          throw new Error(`Expected finite numbers: ${path}`);
        }
        candidate = current + by;
        break;
      }
      case 'state.diff': {
        const rows = (key: string) => {
          const found = context.state[key];
          if (!Array.isArray(found)) throw new Error(`Expected list: ${key}`);
          return found as Record<string, unknown>[];
        };
        const seen = rows(step.without).map((row) => sameThing(row[step.field]));
        const zero = { string: '', number: 0, boolean: false, date: null } as const;
        const of = (declaration as { of: Record<string, keyof typeof zero> }).of;
        candidate = rows(step.from).filter((row) => !seen.some((x) => matches(sameThing(row[step.field]), x))).map((row) => ({
          ...Object.fromEntries(Object.entries(of).map(([key, type]) => [key, zero[type]])), [step.field]: row[step.field] }));
        break;
      }
      case 'state.reset': candidate = structuredClone(declaration.default); break;
    }
    // Reuse the declaration's complete scalar/list checks before a single atomic write.
    const checked = StateDeclSchema.safeParse({ ...declaration, default: candidate });
    if (!checked.success || candidate === undefined) throw new Error(`Invalid value for ${path}: ${checked.error?.message}`);
    store.setState({ [path]: structuredClone(candidate) });
  }

  async function execute(step: ActionStep, context: ValueContext): Promise<boolean> {
    const text = (input: string) => resolveTemplate(input, context);
    if ('path' in step) {
      changeState(step, context);
      return true;
    }
    switch (step.op) {
      case 'confirm': return await services.confirm(text(step.message));
      case 'toast': await services.toast(text(step.message)); break;
      case 'share': await services.share(text(step.text)); break;
      case 'navigate': await services.navigate(step.screen); break;
      case 'notify':
        if (!services.notify) throw new Error('Notifications are unavailable.');
        await services.notify({ title: text(step.title), body: text(step.body) });
        break;
      case 'ai.run':
        if (!services.ai) throw new Error('AI is unavailable.');
        await services.ai({ ...structuredClone(step), prompt: text(step.prompt),
          ...(step.image === undefined ? {} : { image: structuredClone(resolveValue(step.image, context)) }) });
        break;
    }
    return true;
  }

  return {
    isBusy: (actionId: string) => busy.has(actionId),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async run(actionId: string, invocation: ActionInvocation = {}): Promise<void> {
      if (busy.has(actionId)) return;
      busy.add(actionId);
      let stepIndex = -1;
      try {
        emit();
        const captured = structuredClone(invocation);
        const action = spec.actions[actionId];
        if (!action) throw new Error(`Unknown action: ${actionId}`);
        for (stepIndex = 0; stepIndex < action.steps.length; stepIndex++) {
          const context = { ...getValueContext(), state: store.getState(), ...captured };
          if (!await execute(action.steps[stepIndex], context)) return;
        }
      } catch (error) {
        console.error('Action failed', { actionId, stepIndex, step: spec.actions[actionId]?.steps[stepIndex], error });
        const op = spec.actions[actionId]?.steps[stepIndex]?.op;
        const message = error instanceof FriendlyError ? error.message
          : op === 'ai.run' && !services.ai ? 'AI is unavailable right now.'
          : op === 'notify' && !services.notify ? 'Notifications are unavailable right now.'
            : 'Something went wrong. Please try again.';
        try { await services.toast(message); }
        catch (toastError) { console.error('Action error toast failed', { actionId, error: toastError }); }
      } finally {
        busy.delete(actionId);
        emit();
      }
    },
  };
}
