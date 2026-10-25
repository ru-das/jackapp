// On-device model for Android (ADR-022). The revision pins the exact bytes; the size is checked after download.
export const LITERT_MODEL = {
  label: 'Gemma 4 E2B',
  repo: 'litert-community/gemma-4-E2B-it-litert-lm',
  revision: '1caa527c1e88b55f046fcd8d2b4265606680663d',
  file: 'gemma-4-E2B-it.litertlm',
  size: 2_588_147_712,
} as const;

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
