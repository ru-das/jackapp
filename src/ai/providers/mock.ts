import type { LLMProvider } from '../provider';

// shortcut: fixed reply, keyword fixtures arrive with T-40.
export const mockProvider: LLMProvider = {
  id: 'mock',
  label: 'Mock',
  caps: { vision: true, jsonSchema: true, contextTokens: 4096 },
  status: () => 'ready',
  async load() {},
  async generate({ signal }) {
    if (signal?.aborted) throw new Error('aborted');
    return '{"ok":true}';
  },
};
