import { z } from 'zod';
import { readJson, writeJson } from './index';

export const SETTINGS_KEY = 'jackapp:settings';

const SettingsSchema = z.object({
  provider: z.enum(['local', 'mock']).catch('local'),
  model: z.enum(['E2B', 'E4B']).catch('E2B'),
});
export type Settings = z.infer<typeof SettingsSchema>;

export async function loadSettings(): Promise<Settings> {
  const raw = await readJson(SETTINGS_KEY);
  return SettingsSchema.parse(typeof raw === 'object' && raw !== null ? raw : {});
}

export const saveSettings = (s: Settings) => writeJson(SETTINGS_KEY, s);
