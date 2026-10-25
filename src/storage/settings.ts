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
  // An explicit choice, never guessed from the interface language.
  currency: z.string().regex(/^[A-Z]{3}$/).catch('USD'),
});
export type Settings = z.infer<typeof SettingsSchema>;

// ponytail: module-level cache so render code can read the currency synchronously; one settings screen writes it, so no subscription.
let currency = 'USD';
export const preferredCurrency = () => currency;

export async function loadSettings(): Promise<Settings> {
  const raw = await readJson(SETTINGS_KEY).catch(() => null); // settings must never block the app; defaults apply
  const settings = SettingsSchema.parse(typeof raw === 'object' && raw !== null ? raw : {});
  currency = settings.currency;
  return settings;
}

export async function saveSettings(s: Settings) {
  await writeJson(SETTINGS_KEY, s);
  currency = s.currency;
}
