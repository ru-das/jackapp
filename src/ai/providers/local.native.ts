// Ported from the author's Kokishin app (MIT): https://github.com/ru-das/kokishin
import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';
import { ggufBytes, MODELS, type ModelId } from '../models';
import type { LLMProvider, ProviderStatus } from '../provider';

const DIR = `${FileSystem.documentDirectory ?? ''}models/`;
type FileInfo = { name: string; size: number };

let model: ModelId = 'E2B';
let ctx: LlamaContext | null = null;
let inflight: Promise<void> | null = null;
let state: ProviderStatus = 'unloaded';
let queue: Promise<unknown> = Promise.resolve();

const files = (): readonly FileInfo[] => MODELS[model].gguf.files;
// Repos share the projector filename; E2B stays unprefixed to reuse the earlier spike download.
const path = (f: FileInfo) => `${DIR}${model === 'E2B' ? '' : `${model}-`}${f.name}`;

export const lastTimings = { tokensPerSec: 0 };

async function hasFile(f: FileInfo) {
  const i = await FileSystem.getInfoAsync(path(f));
  return i.exists && i.size === f.size;
}

async function download(onProgress?: (p: { loaded: number; total: number }) => void) {
  await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  const total = ggufBytes(model);
  const base = `https://huggingface.co/${MODELS[model].gguf.repo}/resolve/main`;
  let done = 0;
  for (const f of files()) {
    if (!(await hasFile(f))) {
      const part = `${path(f)}.part`;
      const before = done;
      // shortcut: no resume across app restarts, restarts the current file. Add AsyncStorage resumeData if phone downloads keep dying.
      await FileSystem.createDownloadResumable(`${base}/${f.name}`, part, {}, (d) =>
        onProgress?.({ loaded: before + d.totalBytesWritten, total }),
      ).downloadAsync();
      const i = await FileSystem.getInfoAsync(part);
      if (!i.exists || i.size !== f.size) {
        await FileSystem.deleteAsync(part, { idempotent: true });
        throw new Error(`Download of ${f.name} failed. Check your connection and try again.`);
      }
      await FileSystem.moveAsync({ from: part, to: path(f) });
    }
    done += f.size;
    onProgress?.({ loaded: done, total });
  }
}

async function doLoad(onProgress?: (p: { loaded: number; total: number }) => void) {
  state = 'downloading';
  await download(onProgress);
  const c = await initLlama({
    model: path(files()[0]),
    n_ctx: 8192,
    n_gpu_layers: 99,
    use_mlock: true,
    ctx_shift: false, // required for multimodal
  });
  const ok = await c.initMultimodal({ path: path(files()[1]), use_gpu: true, image_max_tokens: 256 });
  if (!ok || !(await c.getMultimodalSupport()).vision) {
    await c.release();
    throw new Error('Vision projector failed to load.');
  }
  ctx = c;
}

export const localProvider: LLMProvider = {
  id: 'local',
  label: 'On-device model',
  caps: { vision: true, jsonSchema: true, contextTokens: 8192 },
  status: () => state,
  async setModel(next) {
    if (next === model) return;
    await inflight?.catch(() => {});
    await ctx?.release();
    ctx = null;
    model = next;
    state = 'unloaded';
  },
  async isDownloaded() {
    return (await Promise.all(files().map(hasFile))).every(Boolean);
  },
  async remove() {
    await inflight?.catch(() => {});
    await ctx?.release();
    ctx = null;
    state = 'unloaded';
    await Promise.all(files().flatMap((f) => [path(f), `${path(f)}.part`])
      .map((p) => FileSystem.deleteAsync(p, { idempotent: true })));
  },
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
