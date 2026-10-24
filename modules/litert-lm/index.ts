import { requireOptionalNativeModule } from 'expo';

export type NativeResult = {
  text: string;
  /** What actually ran: the engine falls back to the CPU, and to no speculation, if init fails. */
  backend: 'GPU' | 'CPU';
  speculative: boolean;
  /** 0 when the model was already loaded. */
  initMs: number;
  firstTokenMs: number;
  genMs: number;
  /** Prompt plus output tokens in the KV cache. */
  kvTokens: number;
};
export type PartialEvent = { chars: number; firstTokenMs: number };
export type GenerateOptions = {
  modelPath: string;
  system: string;
  prompt: string;
  /** Bare base64, no data: prefix. */
  images: string[];
  temperature: number;
  /** 0 = the model's default. */
  maxTokens: number;
  backend: 'gpu' | 'cpu';
  speculative: boolean;
  /** Decode only syntactically valid JSON objects. */
  constrained: boolean;
};

type Native = {
  generate(options: GenerateOptions): Promise<NativeResult>;
  warmUp(modelPath: string, backend: 'gpu' | 'cpu', speculative: boolean): Promise<{ backend: 'GPU' | 'CPU'; speculative: boolean; initMs: number }>;
  cancel(): void;
  release(): void;
  addListener(event: 'onPartial', cb: (e: PartialEvent) => void): { remove(): void };
};

// Null on web, in Expo Go and in a dev build made before this module was added; the provider then reports itself unavailable.
export const LiteRtLm = requireOptionalNativeModule<Native>('LiteRtLm') ?? null;
