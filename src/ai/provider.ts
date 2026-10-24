import { mockProvider } from './providers/mock';
import { localProvider } from './providers/litert';
import { ollamaProvider } from './providers/ollama';
import { openrouterProvider } from './providers/openrouter';
import { LITERT_MODEL, OPENROUTER_MODELS } from './models';
import { loadSettings } from '@/storage/settings';

export type Stage = 'plan' | 'fill' | 'repair' | 'run';

export interface LLMProvider {
  id: 'mock' | 'openrouter' | 'ollama' | 'local';
  label: string;
  caps: { vision: boolean; jsonSchema: boolean; contextTokens: number };
  /** False until Settings has what the provider needs (API key, model name, downloaded model). */
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
    /** Streaming progress: characters produced so far. Only the on-device provider reports it. */
    onPartial?(chars: number): void;
    /** Provider internals for the eval log: retries, backend, timings. */
    onLog?(message: string): void;
  }): Promise<string>;
}

/** On-device speed and reliability switches. Session-only; the eval screen flips them to compare runs. */
export interface LocalTuning {
  /** CPU is the comparison run; the engine also falls back to it by itself if the GPU fails. */
  backend: 'gpu' | 'cpu';
  /** Experimental draft-model decoding. Falls back to plain decoding if the engine rejects it. */
  speculative: boolean;
  /** Decode only syntactically valid JSON. Switches itself off for the session if the engine rejects it. */
  constrained: boolean;
}

/** The downloadable on-device model (Android only). */
export interface LocalModel {
  /** False on web and in builds without the native module. */
  available: boolean;
  tuning: LocalTuning;
  /** Loads the model into memory ahead of the first request. Never throws. */
  warmUp(): Promise<void>;
  isDownloaded(): Promise<boolean>;
  /** Throws a friendly error; leaves no partial file behind. */
  download(onProgress: (p: { loaded: number; total: number }) => void): Promise<void>;
  remove(): Promise<void>;
}

export function getProvider(id: LLMProvider['id']): LLMProvider {
  return id === 'mock' ? mockProvider : id === 'ollama' ? ollamaProvider : id === 'local' ? localProvider : openrouterProvider;
}

/** The provider chosen in Settings, plus the model name recorded in `meta.generatedBy`. */
export async function getActiveProvider() {
  const settings = await loadSettings();
  const provider = getProvider(settings.provider);
  const model = provider.id === 'ollama' ? settings.ollamaModel
    : provider.id === 'mock' ? 'mock'
    : provider.id === 'local' ? LITERT_MODEL.file
    : OPENROUTER_MODELS.fill;
  return { provider, model };
}
