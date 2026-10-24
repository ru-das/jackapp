import { mockProvider } from './providers/mock';
import { ollamaProvider } from './providers/ollama';
import { openrouterProvider } from './providers/openrouter';
import { OPENROUTER_MODELS } from './models';
import { loadSettings } from '@/storage/settings';

export type Stage = 'plan' | 'fill' | 'repair' | 'run';

export interface LLMProvider {
  id: 'mock' | 'openrouter' | 'ollama';
  label: string;
  caps: { vision: boolean; jsonSchema: boolean; contextTokens: number };
  /** False until Settings has what the provider needs (API key, model name). */
  isConfigured(): Promise<boolean>;
  generate(req: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[]; // images: data URLs
    jsonSchema?: object;
    maxTokens?: number;
    temperature?: number;
    /** Lets OpenRouter pick a different model per step; other providers ignore it. */
    stage?: Stage;
    signal?: AbortSignal;
  }): Promise<string>;
}

export function getProvider(id: LLMProvider['id']): LLMProvider {
  return id === 'mock' ? mockProvider : id === 'ollama' ? ollamaProvider : openrouterProvider;
}

/** The provider chosen in Settings, plus the model name recorded in `meta.generatedBy`. */
export async function getActiveProvider() {
  const settings = await loadSettings();
  const provider = getProvider(settings.provider);
  const model = provider.id === 'ollama' ? settings.ollamaModel : provider.id === 'mock' ? 'mock' : OPENROUTER_MODELS.fill;
  return { provider, model };
}
