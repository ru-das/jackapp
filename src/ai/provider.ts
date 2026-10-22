import { mockProvider } from './providers/mock';
import { localProvider } from './providers/local';
import { loadSettings } from '@/storage/settings';
import type { ModelId } from './models';

export type ProviderStatus = 'unloaded' | 'downloading' | 'ready' | 'error';

export interface LLMProvider {
  id: 'mock' | 'local';
  label: string;
  caps: { vision: boolean; jsonSchema: boolean; contextTokens: number };
  status(): ProviderStatus;
  /** Switching to a different model releases the loaded one; files stay on disk. */
  setModel(model: ModelId): Promise<void>;
  /** True when the selected model's files are already stored, so load() will not download. */
  isDownloaded(): Promise<boolean>;
  /** Releases the model and deletes its downloaded files. */
  remove(): Promise<void>;
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

/** The provider and model chosen in Settings. */
export async function getActiveProvider() {
  const { provider, model } = await loadSettings();
  const p = getProvider(provider);
  await p.setModel(model);
  return { provider: p, model };
}
