import { mockProvider } from './providers/mock';
import { localProvider } from './providers/litert';
import { ollamaProvider } from './providers/ollama';
import { LITERT_MODEL } from './models';
import { loadSettings } from '@/storage/settings';

export type Stage = 'plan' | 'fill' | 'repair' | 'run';

export interface LLMProvider {
  id: 'mock' | 'ollama' | 'local';
  label: string;
  caps: { vision: boolean; jsonSchema: boolean; contextTokens: number };
  /** False until Settings has what the provider needs (API key, model name, downloaded model). */
  isConfigured(): Promise<boolean>;
  generate(req: {
    system: string;
    messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[]; // images: data URLs
    jsonSchema?: object;
    /** The reply is plain text lines, not JSON: skips any JSON-only decoding (the generator's line format, ADR-023). */
    plainText?: boolean;
    maxTokens?: number;
    temperature?: number;
    /** Which step of generation this call is; providers may use it to pick settings. */
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
  /** True once the engine has the model in memory this session; downloaded is a separate, weaker state. */
  isLoaded(): boolean;
  /** Bytes of an interrupted download kept on disk, 0 if none. The next `download` resumes from them. */
  partialBytes(): Promise<number>;
  /** Keeps the partial file on interruption or abort so the next call resumes; throws a friendly error (`aborted` on abort). */
  download(onProgress: (p: { loaded: number; total: number }) => void, signal?: AbortSignal): Promise<void>;
  remove(): Promise<void>;
}

export function getProvider(id: LLMProvider['id']): LLMProvider {
  return id === 'mock' ? mockProvider : id === 'local' ? localProvider : ollamaProvider;
}

/** The provider chosen in Settings, plus the model name recorded in `meta.generatedBy`. */
export async function getActiveProvider() {
  const settings = await loadSettings();
  const provider = getProvider(settings.provider);
  const model = provider.id === 'ollama' ? settings.ollamaModel
    : provider.id === 'mock' ? 'mock'
    : LITERT_MODEL.file;
  return { provider, model };
}
