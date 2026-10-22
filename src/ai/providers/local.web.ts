import type { LLMProvider } from '../provider';

export const lastTimings = { tokensPerSec: 0 };

// shortcut: stub until the Transformers.js spike (T-11).
export const localProvider: LLMProvider = {
  id: 'local',
  label: 'On-device (web)',
  caps: { vision: false, jsonSchema: false, contextTokens: 4096 },
  status: () => 'unloaded',
  async load() {
    throw new Error("This browser can't run the model yet. Use the Android app.");
  },
  async generate() {
    throw new Error("This browser can't run the model yet. Use the Android app.");
  },
};
