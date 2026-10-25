import { ProviderError } from '../errors';
import type { LLMProvider, LocalModel } from '../provider';

// Web build: the on-device model only exists in the Android app (ADR-022).
const UNAVAILABLE = 'On-device AI only works in the Android app.';

export const localProvider: LLMProvider = {
  id: 'local',
  label: 'On-device (Android app only)',
  caps: { vision: true, jsonSchema: false, contextTokens: 8192 },
  isConfigured: async () => false,
  generate: async () => { throw new ProviderError(UNAVAILABLE); },
};

export const localModel: LocalModel = {
  available: false,
  tuning: { backend: 'gpu', speculative: false, constrained: true },
  warmUp: async () => {},
  isDownloaded: async () => false,
  isLoaded: () => false,
  partialBytes: async () => 0,
  download: async () => { throw new ProviderError(UNAVAILABLE); },
  remove: async () => {},
};
