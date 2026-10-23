// Ids and download sizes verified on Hugging Face; see ADR-003 and ADR-020.
export type ModelId = 'E2B' | 'E4B' | 'Qwen3.5-2B';

export const MODELS = {
  E2B: {
    label: 'Gemma 4 E2B',
    note: 'Recommended. Fits most phones.',
    gguf: {
      repo: 'unsloth/gemma-4-E2B-it-GGUF',
      files: [
        { name: 'gemma-4-E2B-it-Q4_0.gguf', size: 3_041_378_400 },
        { name: 'mmproj-F16.gguf', size: 985_654_080 },
      ],
    },
    onnx: 'onnx-community/gemma-4-E2B-it-ONNX',
  },
  E4B: {
    label: 'Gemma 4 E4B',
    note: 'Better answers, needs more memory and storage.',
    gguf: {
      repo: 'unsloth/gemma-4-E4B-it-GGUF',
      files: [
        { name: 'gemma-4-E4B-it-Q4_0.gguf', size: 4_836_002_944 },
        { name: 'mmproj-F16.gguf', size: 990_372_672 },
      ],
    },
    onnx: 'onnx-community/gemma-4-E4B-it-ONNX',
  },
  'Qwen3.5-2B': {
    label: 'Qwen3.5-2B',
    note: 'Smaller download. Q4_K_M on Android, with photo support.',
    gguf: {
      repo: 'unsloth/Qwen3.5-2B-GGUF',
      files: [
        { name: 'Qwen3.5-2B-Q4_K_M.gguf', size: 1_280_835_840 },
        { name: 'mmproj-F16.gguf', size: 668_227_264 },
      ],
    },
    onnx: 'onnx-community/Qwen3.5-2B-ONNX',
  },
} as const;

export const ggufBytes = (id: ModelId) => MODELS[id].gguf.files.reduce((n, f) => n + f.size, 0);
