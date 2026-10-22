import AsyncStorage from '@react-native-async-storage/async-storage';

export const dataKey = (appId: string) => `jackapp:data:${appId}`;

export async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (e) {
    console.warn(`storage: could not read ${key}`, e);
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`storage: could not write ${key}`, e);
  }
}
