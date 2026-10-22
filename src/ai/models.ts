// Ids verified on the Hugging Face repos (E4B on 2026-10-23); see ADR-003.
export type ModelId = 'E2B' | 'E4B';

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
} as const;

export const ggufBytes = (id: ModelId) => MODELS[id].gguf.files.reduce((n, f) => n + f.size, 0);
