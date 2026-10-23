import { MODELS, type ModelId } from '../models';
import type { LLMProvider, ProviderStatus } from '../provider';

export const NO_GPU_NOTICE = 'No GPU found: running on CPU, this will be slow. The Android app is faster.';
const FRIENDLY = "This browser can't run the model. Use the Android app.";

type Progress = { loaded: number; total: number };
type Reply =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  | { type: 'done'; id: number; text: string; tokensPerSec: number }
  | { type: 'error'; id?: number; message: string };

export const lastTimings = { tokensPerSec: 0 };

let worker: Worker | null = null;
let inflight: Promise<void> | null = null;
let state: ProviderStatus = 'unloaded';
let queue: Promise<unknown> = Promise.resolve();
let warned = false;
let nextId = 0;
let model: ModelId = 'E2B';
// Transformers.js caches model files here; the worker owns the cache, we only inspect or clear it.
const CACHE = 'transformers-cache';

function stopWorker() {
  worker?.terminate();
  worker = null;
  state = 'unloaded';
}

function getWorker() {
  worker ??= new Worker(`${process.env.EXPO_BASE_URL ?? ''}/llm-worker.js`, { type: 'module' });
  return worker;
}

function doLoad(onProgress?: (p: Progress) => void) {
  state = 'downloading';
  return new Promise<void>((resolve, reject) => {
    const w = getWorker();
    const done = () => {
      w.removeEventListener('message', onMsg);
      w.removeEventListener('error', onErr);
    };
    const onMsg = ({ data }: MessageEvent<Reply>) => {
      if (data.type === 'progress') onProgress?.({ loaded: data.loaded, total: data.total });
      else if (data.type === 'ready') {
        done();
        if (data.device === 'wasm' && !warned) {
          warned = true;
          console.warn(NO_GPU_NOTICE);
          globalThis.alert?.(NO_GPU_NOTICE);
        }
        resolve();
      } else if (data.type === 'error') {
        done();
        reject(new Error(data.message));
      }
    };
    const onErr = (e: ErrorEvent) => {
      done();
      reject(new Error(e.message || 'worker failed'));
    };
    w.addEventListener('message', onMsg);
    w.addEventListener('error', onErr);
    w.postMessage({ type: 'load', model: MODELS[model].onnx });
  });
}

function run(req: Parameters<LLMProvider['generate']>[0]) {
  return new Promise<string>((resolve, reject) => {
    if (state !== 'ready' || !worker) return reject(new Error('Model not loaded.'));
    if (req.signal?.aborted) return reject(new Error('aborted'));
    const w = worker;
    const id = nextId++;
    const finish = () => {
      w.removeEventListener('message', onMsg);
      req.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => w.postMessage({ type: 'abort' });
    const onMsg = ({ data }: MessageEvent<Reply>) => {
      if (data.type === 'done' && data.id === id) {
        finish();
        lastTimings.tokensPerSec = data.tokensPerSec;
        if (req.signal?.aborted) reject(new Error('aborted'));
        else resolve(data.text.trim());
      } else if (data.type === 'error' && data.id === id) {
        finish();
        console.error('[local.web] generate failed', data.message);
        reject(new Error(data.message));
      }
    };
    w.addEventListener('message', onMsg);
    req.signal?.addEventListener('abort', onAbort);
    // jsonSchema is not sent: Transformers.js has no constrained decoding, the generator's repair loop covers it.
    w.postMessage({
      type: 'generate',
      id,
      system: req.system,
      messages: req.messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
    });
  });
}

export const localProvider: LLMProvider = {
  id: 'local',
  label: 'In-browser (Gemma 4)',
  caps: { vision: true, jsonSchema: false, contextTokens: 4096 },
  status: () => state,
  async setModel(next) {
    if (next === model) return;
    await inflight?.catch(() => {});
    stopWorker();
    model = next;
  },
  async isDownloaded() {
    try {
      const keys = await (await caches.open(CACHE)).keys();
      return keys.some((r) => r.url.includes(MODELS[model].onnx));
    } catch {
      return false;
    }
  },
  async remove() {
    await inflight?.catch(() => {});
    stopWorker();
    // shortcut: clears every cached model, not just the selected one; fine while two models exist.
    await caches.delete(CACHE);
  },
  load(onProgress) {
    if (state === 'ready') return Promise.resolve();
    inflight ??= doLoad(onProgress)
      .then(() => {
        state = 'ready';
      })
      .catch((e) => {
        console.error('[local.web] load failed', e);
        state = 'error';
        worker?.terminate();
        worker = null;
        throw new Error(FRIENDLY);
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  generate(req) {
    const next = queue.then(() => run(req));
    queue = next.catch(() => {});
    return next;
  },
};
