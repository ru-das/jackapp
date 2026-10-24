import { requireOptionalNativeModule } from 'expo';

export type NativeResult = {
  text: string;
  backend: 'GPU' | 'CPU';
  /** 0 when the model was already loaded. */
  initMs: number;
  firstTokenMs: number;
  genMs: number;
  /** Prompt plus output tokens in the KV cache. */
  kvTokens: number;
};
export type PartialEvent = { chars: number; firstTokenMs: number };

type Native = {
  generate(modelPath: string, system: string, prompt: string, images: string[], temperature: number, maxTokens: number): Promise<NativeResult>;
  cancel(): void;
  release(): void;
  addListener(event: 'onPartial', cb: (e: PartialEvent) => void): { remove(): void };
};

// Null on web, in Expo Go and in a dev build made before this module was added; the provider then reports itself unavailable.
export const LiteRtLm = requireOptionalNativeModule<Native>('LiteRtLm') ?? null;
