// Free OpenRouter models per stage (ADR-021). Nemotron was tried for PLAN and ai.run: it spends its whole token budget reasoning (183 s, no text), so Gemma serves every stage; the 26B MoE plans, the 31B builds and repairs.
// Ids checked against openrouter.ai/api/v1/models on 2026-10-24; free models come and go, so every request also names fallbacks. A model with status != 0 at /api/v1/models/<id>/endpoints is down.
export const OPENROUTER_MODELS = {
  plan: 'google/gemma-4-26b-a4b-it:free',
  fill: 'google/gemma-4-31b-it:free',
  repair: 'google/gemma-4-31b-it:free',
  run: 'google/gemma-4-31b-it:free',
} as const;

// Named models only: the catch-all `openrouter/free` once answered PLAN with a 2.6B model and hid the real failure.
export const OPENROUTER_FALLBACKS = ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'] as const;
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
