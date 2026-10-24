import { Platform } from 'react-native';
import { z } from 'zod';
import { DEFAULT_OLLAMA_URL } from '@/ai/models';
import { readJson, writeJson } from './index';

export const SETTINGS_KEY = 'jackapp:settings';

const httpUrl = z.string().refine((v) => /^https?:\/\/[^\s/]+/i.test(v));

// Fresh Android installs start on-device (ADR-022); web has no on-device model. Junk saved values fall back to OpenRouter.
const SettingsSchema = z.object({
  provider: z.enum(['local', 'openrouter', 'ollama', 'mock']).default(Platform.OS === 'android' ? 'local' : 'openrouter').catch('openrouter'),
  openrouterKey: z.string().catch(''),
  ollamaUrl: httpUrl.catch(DEFAULT_OLLAMA_URL),
  ollamaModel: z.string().catch(''),
});
export type Settings = z.infer<typeof SettingsSchema>;

export async function loadSettings(): Promise<Settings> {
  const raw = await readJson(SETTINGS_KEY);
  return SettingsSchema.parse(typeof raw === 'object' && raw !== null ? raw : {});
}

export const saveSettings = (s: Settings) => writeJson(SETTINGS_KEY, s);
