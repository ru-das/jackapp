// Ported from the author's Kokishin app (MIT): https://github.com/ru-das/kokishin
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';
import type { LLMProvider, ProviderStatus } from '../provider';

const HF = 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main';
const DIR = `${FileSystem.documentDirectory ?? ''}models/`;
// Q4_0: the only quant (with Q6_K) that Android GPU offload supports.
export const FILES = [
  { name: 'gemma-4-E2B-it-Q4_0.gguf', size: 3_041_378_400 },
  { name: 'mmproj-F16.gguf', size: 985_654_080 },
] as const;
const TOTAL = FILES[0].size + FILES[1].size;

let ctx: LlamaContext | null = null;
let inflight: Promise<void> | null = null;
let state: ProviderStatus = 'unloaded';
let queue: Promise<unknown> = Promise.resolve();

export const lastTimings = { tokensPerSec: 0 };

async function hasFile(f: (typeof FILES)[number]) {
  const i = await FileSystem.getInfoAsync(DIR + f.name);
  return i.exists && i.size === f.size;
}

async function download(onProgress?: (p: { loaded: number; total: number }) => void) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  let done = 0;
  for (const f of FILES) {
    if (!(await hasFile(f))) {
      const part = `${DIR}${f.name}.part`;
      const base = done;
      // shortcut: no resume across app restarts, restarts the current file. Add AsyncStorage resumeData if phone downloads keep dying.
      await FileSystem.createDownloadResumable(`${HF}/${f.name}`, part, {}, (d) =>
        onProgress?.({ loaded: base + d.totalBytesWritten, total: TOTAL }),
      ).downloadAsync();
      const i = await FileSystem.getInfoAsync(part);
      if (!i.exists || i.size !== f.size) {
        await FileSystem.deleteAsync(part, { idempotent: true });
        throw new Error(`Download of ${f.name} failed. Check your connection and try again.`);
      }
      await FileSystem.moveAsync({ from: part, to: DIR + f.name });
    }
    done += f.size;
    onProgress?.({ loaded: done, total: TOTAL });
  }
}

async function doLoad(onProgress?: (p: { loaded: number; total: number }) => void) {
  state = 'downloading';
  await download(onProgress);
  const c = await initLlama({
    model: DIR + FILES[0].name,
    n_ctx: 8192,
    n_gpu_layers: 99,
    use_mlock: true,
    ctx_shift: false, // required for multimodal
  });
  const ok = await c.initMultimodal({ path: DIR + FILES[1].name, use_gpu: true, image_max_tokens: 256 });
  if (!ok || !(await c.getMultimodalSupport()).vision) {
    await c.release();
    throw new Error('Vision projector failed to load.');
  }
  ctx = c;
}

export const localProvider: LLMProvider = {
  id: 'local',
  label: 'On-device (Gemma 4 E2B)',
  caps: { vision: true, jsonSchema: true, contextTokens: 8192 },
  status: () => state,
  load(onProgress) {
    if (ctx) return Promise.resolve();
    inflight ??= doLoad(onProgress)
      .then(() => {
        state = 'ready';
      })
      .catch((e) => {
        console.error('[local] load failed', e);
        state = 'error';
        throw e;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  generate(req) {
    // llama.rn handles one completion at a time.
    const run = async () => {
      if (!ctx) throw new Error('Model not loaded.');
      if (req.signal?.aborted) throw new Error('aborted');
      const c = ctx;
      const onAbort = () => void c.stopCompletion();
      req.signal?.addEventListener('abort', onAbort);
      try {
        const messages = [
          { role: 'system' as const, content: req.system },
          ...req.messages.map((m) => ({
            role: m.role,
            content: m.images?.length
              ? [
                  { type: 'text' as const, text: m.content },
                  ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
                ]
              : m.content,
          })),
        ];
        const r = await c.completion({
          messages,
          n_predict: req.maxTokens,
          temperature: req.temperature,
          enable_thinking: false,
          ...(req.jsonSchema && {
            response_format: {
              type: 'json_schema',
              json_schema: { strict: true, schema: req.jsonSchema },
            },
          }),
        });
        lastTimings.tokensPerSec = r.timings?.predicted_per_second ?? 0;
        if (req.signal?.aborted) throw new Error('aborted');
        return r.text.trim();
      } finally {
        req.signal?.removeEventListener('abort', onAbort);
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  },
};
