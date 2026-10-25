import { useSyncExternalStore } from 'react';
import { dataKey, readJson, StorageError, writeJson } from '@/storage';
import type { Spec, StateDecl } from '@/spec/types';
import { StateDeclSchema } from '@/spec/schema';

export type State = Record<string, unknown>;
export type Store = ReturnType<typeof createStore>;
export type Removal = { key: string; prev: unknown[]; removed: number };

const SAVE_DELAY_MS = 500;

function fits(decl: StateDecl, v: unknown): boolean {
  switch (decl.type) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'list': return Array.isArray(v);
    case 'image': return StateDeclSchema.safeParse({ ...decl, default: v }).success;
    default: return v === null || typeof v === 'string'; // date
  }
}

export function createStore(appId: string, decls: Spec['state'], onSaveError?: (e: unknown) => void) {
  const defaults = (): State =>
    Object.fromEntries(Object.entries(decls).map(([k, d]) => [k, structuredClone(d.default)]));
  let state = defaults();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A failed write stays pending so the next flush or change retries it.
  let pending = false;
  let inflight: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  // Only the latest shrink is kept: undo is one step, not a history.
  let removal: Removal | null = null;

  // Writes run one at a time; a caller waits for every earlier write, then writes if still pending.
  const save = (): Promise<void> => {
    timer = undefined;
    const run = inflight.then(async () => {
      if (!pending) return;
      pending = false;
      const out = Object.fromEntries(Object.entries(state).filter(([k]) => decls[k].persist !== false));
      try {
        await writeJson(dataKey(appId), out);
      } catch (e) {
        pending = true;
        onSaveError?.(e);
        throw e;
      }
    });
    inflight = run.catch(() => {});
    return run;
  };

  const store = {
    getState: () => state,
    setState(next: State | ((s: State) => State)) {
      const patch = typeof next === 'function' ? next(state) : next;
      for (const [k, v] of Object.entries(patch)) {
        const old = state[k];
        if (Array.isArray(old) && Array.isArray(v) && v.length < old.length) removal = { key: k, prev: old, removed: old.length - v.length };
        else if (removal?.key === k) removal = null;
      }
      state = { ...state, ...patch };
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(() => { void save().catch(() => {}); }, SAVE_DELAY_MS);
      listeners.forEach((l) => l());
    },
    lastRemoval: (): Removal | null => removal,
    /** Puts the removed rows back; false if nothing is left to undo. */
    undo(): boolean {
      if (!removal) return false;
      const { key, prev } = removal;
      store.setState({ [key]: prev });
      return true;
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    /** Restores persisted keys over the defaults; anything undeclared, persist:false or mistyped is ignored. */
    async load() {
      // Unreadable data keeps defaults; unavailable storage throws so the app is not opened empty and then saved over real data.
      const saved = await readJson(dataKey(appId)).catch((e) => {
        if (e instanceof StorageError && e.kind === 'unreadable') return null;
        throw e;
      });
      if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return;
      const restored = Object.entries(saved).filter(
        ([k, v]) => Object.hasOwn(decls, k) && decls[k].persist !== false && fits(decls[k], v),
      );
      state = { ...state, ...Object.fromEntries(restored) };
      listeners.forEach((l) => l());
    },
    /** Writes any pending change now and waits for a write already running; rejects if the save still fails. */
    flush() {
      clearTimeout(timer);
      return save();
    },
  };
  return store;
}

export function useStoreState(store: Store): State {
  return useSyncExternalStore(store.subscribe, store.getState);
}
