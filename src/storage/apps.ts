import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { cancelTriggers } from '@/capabilities';
import { dataKey, readJson, removeKey, specKey, StorageError, writeJson } from './index';

export type AppSummary = { id: string; name: string; icon?: string; damaged?: boolean };

const SPEC_PREFIX = specKey('');
// Dev fixtures share the spec namespace but are not the user's apps.
const isUserApp = (id: string) => !id.startsWith('fixture-');

// Home stays mounted under Create/Run, so saves elsewhere must tell it to reload the list.
const listeners = new Set<() => void>();
export const notifyAppsChanged = () => listeners.forEach((l) => l());
export function subscribeApps(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export const newAppId = () => `app-${Date.now()}`;

export async function listApps(): Promise<AppSummary[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(SPEC_PREFIX));
  const apps = await Promise.all(keys.map(async (k): Promise<AppSummary> => {
    const id = k.slice(SPEC_PREFIX.length);
    // A corrupt blob is one damaged row; a storage failure must reach the caller, not look like an empty list.
    const raw = await readJson(k).catch((e) => {
      if (e instanceof StorageError && e.kind === 'unreadable') return null;
      throw e;
    });
    if (validate(raw).length) return { id, name: 'Damaged mini-app', damaged: true };
    const { meta } = SpecSchema.parse(raw);
    return { id, name: meta.name, icon: meta.icon };
  }));
  // ids are `app-<timestamp>`, so a descending sort puts the newest first.
  return apps.filter((a) => isUserApp(a.id)).sort((a, b) => b.id.localeCompare(a.id));
}

async function loadValid(id: string): Promise<Spec | null> {
  const raw = await readJson(specKey(id)).catch(() => null); // rename/duplicate report any read failure as "couldn't"
  return raw !== null && !validate(raw).length ? SpecSchema.parse(raw) : null;
}

export async function renameApp(id: string, name: string): Promise<boolean> {
  const spec = await loadValid(id);
  const next = name.trim();
  if (!spec || !next) return false;
  const renamed = { ...spec, meta: { ...spec.meta, name: next } };
  if (validate(renamed).length) return false;
  return writeJson(specKey(id), renamed).then(() => true, () => false);
}

/** Copies the spec only; the copy starts with fresh data. */
export async function duplicateApp(id: string, copyName: (name: string) => string): Promise<string | null> {
  const spec = await loadValid(id);
  if (!spec) return null;
  const copy = { ...spec, meta: { ...spec.meta, name: copyName(spec.meta.name) } };
  if (validate(copy).length) return null;
  const newId = newAppId();
  return writeJson(specKey(newId), copy).then(() => newId, () => null);
}

export async function deleteApp(id: string): Promise<void> {
  await cancelTriggers(id).catch((e) => console.warn('cancelTriggers failed', e));
  await removeKey(specKey(id));
  await removeKey(dataKey(id));
}
