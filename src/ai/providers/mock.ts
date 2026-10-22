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

/** Isolated scripts keep repair tests independent of the UI singleton. */
export function createScriptedMock(responses: readonly (string | Error)[]): LLMProvider {
  let next = 0;
  return {
    ...mockProvider,
    caps: { ...mockProvider.caps },
    async generate({ signal }) {
      if (signal?.aborted) throw new Error('aborted');
      if (next >= responses.length) throw new Error('Scripted mock exhausted.');
      const response = responses[next++];
      if (response instanceof Error) throw response;
      return response;
    },
  };
}
