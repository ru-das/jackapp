// Free OpenRouter models, one per stage so a weak spot in one model does not sink the whole build (ADR-021).
// Ids checked against openrouter.ai/api/v1/models on 2026-10-24; free models come and go, so every request also names a fallback.
export const OPENROUTER_MODELS = {
  plan: 'nvidia/nemotron-3-super-120b-a12b:free',
  fill: 'google/gemma-4-31b-it:free',
  repair: 'google/gemma-4-26b-a4b-it:free',
  run: 'nvidia/nemotron-3.5-super-vl:free',
} as const;

export const OPENROUTER_FALLBACK = 'openrouter/free';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
