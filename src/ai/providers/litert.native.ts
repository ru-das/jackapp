import * as FileSystem from 'expo-file-system/legacy';
import { LiteRtLm } from '../../../modules/litert-lm';
import { LITERT_MODEL } from '../models';
import type { LLMProvider, LocalModel, LocalTuning } from '../provider';

const NEEDS_MODEL = 'Download the on-device model in Settings first.';
const UNAVAILABLE = 'On-device AI is not part of this build.';

const dir = () => `${FileSystem.documentDirectory ?? ''}models/`;
const path = () => `${dir()}${LITERT_MODEL.file}`;
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
      if (LiteRtLm && (await hasModel())) await LiteRtLm.warmUp(nativePath(), tuning.backend, tuning.speculative);
    } catch (e) {
      console.warn('[local] warm-up failed', e);
    }
  },
  isDownloaded: hasModel,
  async download(onProgress) {
    if (await hasModel()) return;
    await FileSystem.makeDirectoryAsync(dir(), { intermediates: true });
    const part = `${path()}.part`;
    const url = `https://huggingface.co/${LITERT_MODEL.repo}/resolve/${LITERT_MODEL.revision}/${LITERT_MODEL.file}`;
    // shortcut: no resume across app restarts, a killed download starts over. Add AsyncStorage resumeData if phone downloads keep dying.
    await FileSystem.createDownloadResumable(url, part, {}, (d) =>
      onProgress({ loaded: d.totalBytesWritten, total: LITERT_MODEL.size }),
    ).downloadAsync();
    const info = await FileSystem.getInfoAsync(part);
    if (!info.exists || info.size !== LITERT_MODEL.size) {
      await FileSystem.deleteAsync(part, { idempotent: true });
      throw new Error('The download did not finish. Check your connection and try again.');
    }
    await FileSystem.moveAsync({ from: part, to: path() });
  },
  async remove() {
    LiteRtLm?.release();
    await Promise.all([path(), `${path()}.part`].map((p) => FileSystem.deleteAsync(p, { idempotent: true })));
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
