import * as FileSystem from 'expo-file-system/legacy';
import { LiteRtLm } from '../../../modules/litert-lm';
import { LITERT_MODEL } from '../models';
import type { LLMProvider, LocalModel, LocalTuning } from '../provider';

const NEEDS_MODEL = 'Download the on-device model in Settings first.';
const UNAVAILABLE = 'On-device AI is not part of this build.';

const dir = () => `${FileSystem.documentDirectory ?? ''}models/`;
const path = () => `${dir()}${LITERT_MODEL.file}`;
// The revision is in the name so a leftover from an older pin is never appended to.
const partPath = () => `${path()}.${LITERT_MODEL.revision.slice(0, 8)}.part`;
// Room for the filesystem and the engine's own cache on top of the file.
const HEADROOM = 300e6;
const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

// Whether the engine holds the model right now; being on disk is a separate fact.
let loaded = false;

async function partSize() {
  const info = await FileSystem.getInfoAsync(partPath());
  return info.exists ? info.size : 0;
}
// Native code wants a plain file path, not a file:// URI.
const nativePath = () => path().replace(/^file:\/\//, '');

async function hasModel() {
  const info = await FileSystem.getInfoAsync(path());
  return info.exists && info.size === LITERT_MODEL.size;
}

// Constrained JSON is on because it removes the BAD_JSON repair round trips; speculative decoding stays off until a phone run shows it helps.
const tuning: LocalTuning = { backend: 'gpu', speculative: false, constrained: true };

export const localModel: LocalModel = {
  available: LiteRtLm !== null,
  tuning,
  async warmUp() {
    try {
      if (LiteRtLm && (await hasModel())) {
        await LiteRtLm.warmUp(nativePath(), tuning.backend, tuning.speculative);
        loaded = true;
      }
    } catch (e) {
      console.warn('[local] warm-up failed', e);
    }
  },
  isDownloaded: hasModel,
  isLoaded: () => loaded,
  partialBytes: partSize,
  async download(onProgress, signal) {
    if (await hasModel()) return;
    await FileSystem.makeDirectoryAsync(dir(), { intermediates: true });
    const part = partPath();
    const total = LITERT_MODEL.size;
    let have = await partSize();
    if (have > total) {
      await FileSystem.deleteAsync(part, { idempotent: true });
      have = 0;
    }
    if (have < total) {
      const free = await FileSystem.getFreeDiskStorageAsync();
      if (free < total - have + HEADROOM) {
        throw new Error(`Needs ${gb(total - have + HEADROOM)} GB free but this phone has ${gb(free)} GB. Free up space and try again.`);
      }
      const url = `https://huggingface.co/${LITERT_MODEL.repo}/resolve/${LITERT_MODEL.revision}/${LITERT_MODEL.file}`;
      // expo-file-system sends `Range: bytes=<resumeData>-` and appends, so the bytes already on disk are all the state we need.
      const task = FileSystem.createDownloadResumable(url, part, {}, (d) =>
        onProgress({ loaded: have + d.totalBytesWritten, total }),
        have > 0 ? String(have) : undefined,
      );
      const stop = () => void task.pauseAsync().catch(() => {});
      signal?.addEventListener('abort', stop);
      try {
        if (signal?.aborted) throw new Error('aborted');
        await task.downloadAsync();
      } catch (e) {
        if (signal?.aborted) throw new Error('aborted');
        console.error('[local] model download interrupted', e);
        throw new Error(`Download stopped at ${gb(await partSize())} of ${gb(total)} GB. Connect to Wi-Fi and tap Resume to continue.`);
      } finally {
        signal?.removeEventListener('abort', stop);
      }
      if (signal?.aborted) throw new Error('aborted');
    }
    const size = await partSize();
    if (size > total) {
      // The server ignored the Range header and the bytes were appended to the old ones.
      await FileSystem.deleteAsync(part, { idempotent: true });
      throw new Error('The download was corrupted, so it was deleted. Tap Download to start again.');
    }
    if (size < total) {
      throw new Error(`Download stopped at ${gb(size)} of ${gb(total)} GB. Connect to Wi-Fi and tap Resume to continue.`);
    }
    await FileSystem.moveAsync({ from: part, to: path() });
  },
  async remove() {
    LiteRtLm?.release();
    loaded = false;
    await Promise.all([path(), partPath()].map((p) => FileSystem.deleteAsync(p, { idempotent: true })));
  },
};

const bare = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

// The generator sends one message; an ai.run retry sends user, assistant, user.
const flatten = (messages: Parameters<LLMProvider['generate']>[0]['messages']) =>
  messages.length === 1 ? messages[0].content
    : messages.map((m) => (m.role === 'assistant' ? `Your previous reply:\n${m.content}` : m.content)).join('\n\n');

// The native engine runs one conversation at a time.
let queue: Promise<unknown> = Promise.resolve();

export const localProvider: LLMProvider = {
  id: 'local',
  label: 'On-device (Gemma 4 E2B)',
  // jsonSchema is false: LiteRT-LM has no grammar mode we use; the prompt, parser and validator enforce shape.
  caps: { vision: true, jsonSchema: false, contextTokens: 8192 },
  isConfigured: async () => LiteRtLm !== null && (await hasModel()),
  generate(req) {
    const run = async () => {
      if (!LiteRtLm) throw new Error(UNAVAILABLE);
      if (req.signal?.aborted) throw new Error('aborted');
      if (!(await hasModel())) throw new Error(NEEDS_MODEL);
      const native = LiteRtLm;
      const images = req.messages.flatMap((m) => m.images ?? []).map(bare);
      const partial = req.onPartial ? native.addListener('onPartial', (e) => req.onPartial?.(e.chars)) : null;
      const onAbort = () => native.cancel();
      req.signal?.addEventListener('abort', onAbort);
      try {
        const call = (constrained: boolean) => native.generate({
          modelPath: nativePath(), system: req.system, prompt: flatten(req.messages), images,
          temperature: req.temperature ?? 0.2, maxTokens: req.maxTokens ?? 0,
          backend: tuning.backend, speculative: tuning.speculative, constrained,
        });
        let constrained = tuning.constrained && !req.plainText;
        let r;
        try {
          r = await call(constrained);
        } catch (e) {
          if (!constrained || req.signal?.aborted) throw e;
          // The grammar is the newest part of the engine; if it fails, keep building without it.
          tuning.constrained = constrained = false;
          req.onLog?.(`constrained JSON failed (${e instanceof Error ? e.message : String(e)}); off for this session, retrying`);
          r = await call(false);
        }
        req.onLog?.(`${r.backend}${r.speculative ? ' + speculative decoding' : ''}, constrained JSON ${constrained ? 'on' : 'off'}: model load ${r.initMs} ms, first token ${r.firstTokenMs} ms, total ${r.genMs} ms, ${r.kvTokens} tokens in cache`);
        loaded = true;
        if (req.signal?.aborted) throw new Error('aborted');
        return r.text.trim();
      } catch (e) {
        if (req.signal?.aborted) throw new Error('aborted');
        console.error('[local] generate failed', e);
        throw e;
      } finally {
        partial?.remove();
        req.signal?.removeEventListener('abort', onAbort);
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => {});
    return next;
  },
};
