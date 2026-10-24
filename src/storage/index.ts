import AsyncStorage from '@react-native-async-storage/async-storage';

export const dataKey = (appId: string) => `jackapp:data:${appId}`;
export const specKey = (appId: string) => `jackapp:spec:${appId}`;

/** `unavailable`: storage itself failed (try again later). `unreadable`: data is there but corrupt. */
export class StorageError extends Error {
  constructor(public kind: 'unavailable' | 'unreadable', message: string, cause: unknown) {
    super(message, { cause });
    this.name = 'StorageError';
  }
}

/** null means the key is missing; a failure throws StorageError. */
export async function readJson(key: string): Promise<unknown> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn(`storage: could not read ${key}`, e);
    throw new StorageError('unavailable', `could not read ${key}`, e);
  }
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`storage: ${key} is not valid JSON`, e);
    throw new StorageError('unreadable', `${key} is not valid JSON`, e);
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`storage: could not write ${key}`, e);
    throw new StorageError('unavailable', `could not write ${key}`, e);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn(`storage: could not remove ${key}`, e);
    throw new StorageError('unavailable', `could not remove ${key}`, e);
  }
}
