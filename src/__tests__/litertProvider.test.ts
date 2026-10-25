import * as FileSystem from 'expo-file-system/legacy';
import { LITERT_MODEL } from '@/ai/models';
import { localModel, localProvider } from '@/ai/providers/litert.native';

const mockNative = {
  generate: jest.fn(),
  warmUp: jest.fn(),
  cancel: jest.fn(),
  release: jest.fn(),
  addListener: jest.fn(),
};
jest.mock('../../modules/litert-lm', () => ({ get LiteRtLm() { return mockNative; } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(async () => {}),
  createDownloadResumable: jest.fn(),
  moveAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
  getFreeDiskStorageAsync: jest.fn(async () => 50e9),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const result = { text: ' {"ok":true} ', backend: 'GPU', speculative: false, initMs: 0, firstTokenMs: 900, genMs: 4000, kvTokens: 4100 };
const present = (size: number) => fs.getInfoAsync.mockResolvedValue({ exists: true, size, uri: '', isDirectory: false } as never);

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(localModel.tuning, { backend: 'gpu', speculative: false, constrained: true });
  mockNative.generate.mockResolvedValue(result);
  mockNative.warmUp.mockResolvedValue({ backend: 'GPU', speculative: false, initMs: 20000 });
  mockNative.addListener.mockReturnValue({ remove: jest.fn() });
  present(LITERT_MODEL.size);
});

test('configured only when the model file has the exact size', async () => {
  expect(await localProvider.isConfigured()).toBe(true);
  present(LITERT_MODEL.size - 1);
  expect(await localProvider.isConfigured()).toBe(false);
  fs.getInfoAsync.mockResolvedValue({ exists: false } as never);
  expect(await localModel.isDownloaded()).toBe(false);
});

test('sends a plain path, system text, flattened retry, bare base64 images and defaults', async () => {
  const out = await localProvider.generate({
    system: 'SYS', temperature: 0.1, maxTokens: 512,
    messages: [
      { role: 'user', content: 'read it', images: ['data:image/jpeg;base64,QUJD'] },
      { role: 'assistant', content: 'bad' },
      { role: 'user', content: 'fix it' },
    ],
  });
  expect(out).toBe('{"ok":true}');
  expect(mockNative.generate).toHaveBeenCalledWith({
    modelPath: `/data/models/${LITERT_MODEL.file}`, system: 'SYS', prompt: 'read it\n\nYour previous reply:\nbad\n\nfix it',
    images: ['QUJD'], temperature: 0.1, maxTokens: 512, backend: 'gpu', speculative: false, constrained: true,
  });
  await localProvider.generate({ system: '', messages: [{ role: 'user', content: 'x' }] });
  expect(mockNative.generate).toHaveBeenLastCalledWith(expect.objectContaining({ system: '', prompt: 'x', images: [], temperature: 0.2, maxTokens: 0 }));
});

test('reports timings and streams partial output to the caller', async () => {
  let emit: (e: { chars: number }) => void = () => {};
  const remove = jest.fn();
  mockNative.addListener.mockImplementation((_name: string, cb: typeof emit) => { emit = cb; return { remove }; });
  mockNative.generate.mockImplementation(async () => { emit({ chars: 120 }); return result; });
  const logs: string[] = [];
  const chars: number[] = [];
  await localProvider.generate({ system: '', messages: [], onLog: (m) => logs.push(m), onPartial: (n) => chars.push(n) });
  expect(chars).toEqual([120]);
  expect(logs[0]).toBe('GPU, constrained JSON on: model load 0 ms, first token 900 ms, total 4000 ms, 4100 tokens in cache');
  expect(remove).toHaveBeenCalled();
});

test('calls run one at a time', async () => {
  const order: string[] = [];
  let release!: () => void;
  mockNative.generate.mockImplementationOnce(() => new Promise((resolve) => { release = () => { order.push('first done'); resolve(result); }; }));
  mockNative.generate.mockImplementationOnce(async () => { order.push('second ran'); return result; });
  const a = localProvider.generate({ system: '', messages: [] });
  const b = localProvider.generate({ system: '', messages: [] });
  await new Promise((r) => setTimeout(r, 20));
  expect(mockNative.generate).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([a, b]);
  expect(order).toEqual(['first done', 'second ran']);
});

test('abort cancels the mockNative run and rejects as aborted', async () => {
  const c = new AbortController();
  mockNative.generate.mockImplementation(() => new Promise((_, reject) => { mockNative.cancel.mockImplementationOnce(() => reject(new Error('mockNative: cancelled'))); }));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const p = localProvider.generate({ system: '', messages: [], signal: c.signal });
  const check = expect(p).rejects.toThrow('aborted');
  await new Promise((r) => setTimeout(r, 20));
  c.abort();
  await check;
  expect(mockNative.cancel).toHaveBeenCalledTimes(1);
});

test('a missing model asks for a download and never reaches the mockNative module', async () => {
  fs.getInfoAsync.mockResolvedValue({ exists: false } as never);
  await expect(localProvider.generate({ system: '', messages: [] })).rejects.toThrow('Download the on-device model');
  expect(mockNative.generate).not.toHaveBeenCalled();
});

const PART = `file:///data/models/${LITERT_MODEL.file}.${LITERT_MODEL.revision.slice(0, 8)}.part`;
// First getInfoAsync is hasModel (no model), the rest report the .part size.
const sizes = (...parts: (number | null)[]) => {
  fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
  parts.forEach((n) => fs.getInfoAsync.mockResolvedValueOnce((n === null ? { exists: false } : { exists: true, size: n }) as never));
};

test('download: pinned URL, progress, and the .part file is moved only when the size matches', async () => {
  sizes(null, LITERT_MODEL.size);
  let onProgress: (d: { totalBytesWritten: number }) => void = () => {};
  fs.createDownloadResumable.mockImplementation(((_url: string, _to: string, _o: unknown, cb: typeof onProgress) => {
    onProgress = cb;
    return { downloadAsync: async () => { onProgress({ totalBytesWritten: 1000 }); } };
  }) as never);
  const seen: number[] = [];
  await localModel.download((p) => seen.push(p.loaded));
  expect(fs.createDownloadResumable.mock.calls[0][0]).toBe(
    `https://huggingface.co/${LITERT_MODEL.repo}/resolve/${LITERT_MODEL.revision}/${LITERT_MODEL.file}`);
  expect(fs.createDownloadResumable.mock.calls[0][4]).toBeUndefined();
  expect(seen).toEqual([1000]);
  expect(fs.moveAsync).toHaveBeenCalledWith({ from: PART, to: `file:///data/models/${LITERT_MODEL.file}` });
});

test('download: resumes from the bytes already on disk, progress includes them', async () => {
  sizes(1000, LITERT_MODEL.size);
  let cb: (d: { totalBytesWritten: number }) => void = () => {};
  fs.createDownloadResumable.mockImplementation(((_u: string, _t: string, _o: unknown, c: typeof cb) => {
    cb = c;
    return { downloadAsync: async () => { cb({ totalBytesWritten: 500 }); } };
  }) as never);
  const seen: number[] = [];
  await localModel.download((p) => seen.push(p.loaded));
  expect(fs.createDownloadResumable.mock.calls[0][4]).toBe('1000');
  expect(seen).toEqual([1500]);
});

test('download: a complete leftover part is moved without downloading', async () => {
  sizes(LITERT_MODEL.size, LITERT_MODEL.size);
  await localModel.download(() => {});
  expect(fs.createDownloadResumable).not.toHaveBeenCalled();
  expect(fs.moveAsync).toHaveBeenCalled();
});

test('download: a part larger than the model is deleted and the download starts fresh', async () => {
  sizes(LITERT_MODEL.size + 5, LITERT_MODEL.size);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync: async () => {} } as never);
  await localModel.download(() => {});
  expect(fs.deleteAsync).toHaveBeenCalledWith(PART, { idempotent: true });
  expect(fs.createDownloadResumable.mock.calls[0][4]).toBeUndefined();
});

test('download: an oversize result (server ignored Range) is deleted with a clear message', async () => {
  sizes(1000, LITERT_MODEL.size + 1000);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync: async () => {} } as never);
  await expect(localModel.download(() => {})).rejects.toThrow('corrupted');
  expect(fs.deleteAsync).toHaveBeenCalledWith(PART, { idempotent: true });
  expect(fs.moveAsync).not.toHaveBeenCalled();
});

test('download: a short file is kept for resume, never moved into place', async () => {
  sizes(null, 5);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync: async () => {} } as never);
  await expect(localModel.download(() => {})).rejects.toThrow('Download stopped at 0.0 of');
  expect(fs.deleteAsync).not.toHaveBeenCalled();
  expect(fs.moveAsync).not.toHaveBeenCalled();
});

test('download: a network error keeps the part and says where it stopped', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  sizes(null, 1_200_000_000);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync: async () => { throw new Error('Network request failed'); } } as never);
  await expect(localModel.download(() => {})).rejects.toThrow(/stopped at 1\.2 of .* tap Resume/);
  expect(fs.deleteAsync).not.toHaveBeenCalled();
});

test('download: low free space fails before any download starts', async () => {
  sizes(null);
  fs.getFreeDiskStorageAsync.mockResolvedValueOnce(1e9);
  await expect(localModel.download(() => {})).rejects.toThrow(/This needs .* GB free, but the phone has 1\.0 GB/);
  expect(fs.createDownloadResumable).not.toHaveBeenCalled();
});

test('download: abort pauses the task, keeps the part and throws aborted', async () => {
  sizes(null);
  const pauseAsync = jest.fn(async () => ({}));
  const ctl = new AbortController();
  fs.createDownloadResumable.mockReturnValue({ pauseAsync, downloadAsync: async () => { ctl.abort(); } } as never);
  await expect(localModel.download(() => {}, ctl.signal)).rejects.toThrow('aborted');
  expect(pauseAsync).toHaveBeenCalled();
  expect(fs.deleteAsync).not.toHaveBeenCalled();
});

test('partialBytes reads the part size, 0 when absent', async () => {
  fs.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 42 } as never);
  expect(await localModel.partialBytes()).toBe(42);
  fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
  expect(await localModel.partialBytes()).toBe(0);
});

test('isLoaded turns true after warm-up and false after remove', async () => {
  await localModel.remove();
  expect(localModel.isLoaded()).toBe(false);
  await localModel.warmUp();
  expect(localModel.isLoaded()).toBe(true);
  await localModel.remove();
  expect(localModel.isLoaded()).toBe(false);
});

test('remove releases the engine and deletes the file and any partial', async () => {
  await localModel.remove();
  expect(mockNative.release).toHaveBeenCalled();
  expect(fs.deleteAsync).toHaveBeenCalledTimes(2);
});

test('the switches reach the engine; the log names what actually ran', async () => {
  Object.assign(localModel.tuning, { backend: 'cpu', speculative: true, constrained: false });
  mockNative.generate.mockResolvedValue({ ...result, backend: 'CPU', speculative: true });
  const logs: string[] = [];
  await localProvider.generate({ system: '', messages: [], onLog: (m) => logs.push(m) });
  expect(mockNative.generate).toHaveBeenCalledWith(expect.objectContaining({ backend: 'cpu', speculative: true, constrained: false }));
  expect(logs[0]).toMatch(/^CPU \+ speculative decoding, constrained JSON off:/);
});

test('if constrained JSON fails the call is retried without it and it stays off', async () => {
  mockNative.generate.mockRejectedValueOnce(new Error('grammar: unsupported keyword')).mockResolvedValueOnce(result);
  const logs: string[] = [];
  expect(await localProvider.generate({ system: '', messages: [], onLog: (m) => logs.push(m) })).toBe('{"ok":true}');
  expect(mockNative.generate.mock.calls.map((c) => c[0].constrained)).toEqual([true, false]);
  expect(logs[0]).toContain('constrained JSON failed (grammar: unsupported keyword)');
  expect(localModel.tuning.constrained).toBe(false);
  await localProvider.generate({ system: '', messages: [] });
  expect(mockNative.generate.mock.calls.at(-1)?.[0].constrained).toBe(false);
});

test('a failure with constrained JSON already off is not retried', async () => {
  localModel.tuning.constrained = false;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockNative.generate.mockRejectedValue(new Error('out of memory'));
  await expect(localProvider.generate({ system: '', messages: [] })).rejects.toThrow('out of memory');
  expect(mockNative.generate).toHaveBeenCalledTimes(1);
});

test('warm-up loads the model with the current switches and never throws', async () => {
  Object.assign(localModel.tuning, { backend: 'cpu', speculative: true });
  await localModel.warmUp();
  expect(mockNative.warmUp).toHaveBeenCalledWith(`/data/models/${LITERT_MODEL.file}`, 'cpu', true);
  mockNative.warmUp.mockRejectedValue(new Error('no memory'));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(localModel.warmUp()).resolves.toBeUndefined();
  fs.getInfoAsync.mockResolvedValue({ exists: false } as never);
  mockNative.warmUp.mockClear();
  await localModel.warmUp();
  expect(mockNative.warmUp).not.toHaveBeenCalled();
});
