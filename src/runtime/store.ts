import { useSyncExternalStore } from 'react';
import { dataKey, readJson, writeJson } from '@/storage';
import type { Spec, StateDecl } from '@/spec/types';
import { StateDeclSchema } from '@/spec/schema';

export type State = Record<string, unknown>;
export type Store = ReturnType<typeof createStore>;

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

export function createStore(appId: string, decls: Spec['state']) {
  const defaults = (): State =>
    Object.fromEntries(Object.entries(decls).map(([k, d]) => [k, structuredClone(d.default)]));
  let state = defaults();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();

  const save = () => {
    timer = undefined;
    const out = Object.fromEntries(Object.entries(state).filter(([k]) => decls[k].persist !== false));
    return writeJson(dataKey(appId), out);
  };

  return {
    getState: () => state,
    setState(next: State | ((s: State) => State)) {
      state = { ...state, ...(typeof next === 'function' ? next(state) : next) };
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_DELAY_MS);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
    /** Restores persisted keys over the defaults; anything undeclared, persist:false or mistyped is ignored. */
    async load() {
      const saved = await readJson(dataKey(appId));
      if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return;
      const restored = Object.entries(saved).filter(
        ([k, v]) => Object.hasOwn(decls, k) && decls[k].persist !== false && fits(decls[k], v),
      );
      state = { ...state, ...Object.fromEntries(restored) };
      listeners.forEach((l) => l());
    },
    /** Writes any pending change now (call on unmount / app background). */
    flush() {
      if (timer === undefined) return Promise.resolve();
      clearTimeout(timer);
      return save();
    },
  };
}

export function useStoreState(store: Store): State {
  return useSyncExternalStore(store.subscribe, store.getState);
}
