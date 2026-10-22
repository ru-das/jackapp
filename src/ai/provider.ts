import { mockProvider } from './providers/mock';
import { localProvider } from './providers/local';

export type ProviderStatus = 'unloaded' | 'downloading' | 'ready' | 'error';

export interface LLMProvider {
  id: 'mock' | 'local';
  label: string;
  caps: { vision: boolean; jsonSchema: boolean; contextTokens: number };
  status(): ProviderStatus;
  load(onProgress?: (p: { loaded: number; total: number }) => void): Promise<void>;
  generate(req: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[]; // images: data URLs
    jsonSchema?: object;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<string>;
}

export function getProvider(id: LLMProvider['id']): LLMProvider {
  return id === 'mock' ? mockProvider : localProvider;
}
