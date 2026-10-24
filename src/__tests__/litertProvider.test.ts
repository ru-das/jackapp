import * as FileSystem from 'expo-file-system/legacy';
import { LITERT_MODEL } from '@/ai/models';
import { localModel, localProvider } from '@/ai/providers/litert.native';

const mockNative = {
  generate: jest.fn(),
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
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const result = { text: ' {"ok":true} ', backend: 'GPU', initMs: 0, firstTokenMs: 900, genMs: 4000, kvTokens: 4100 };
const present = (size: number) => fs.getInfoAsync.mockResolvedValue({ exists: true, size, uri: '', isDirectory: false } as never);

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.generate.mockResolvedValue(result);
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
  expect(mockNative.generate).toHaveBeenCalledWith(
    `/data/models/${LITERT_MODEL.file}`, 'SYS', 'read it\n\nYour previous reply:\nbad\n\nfix it', ['QUJD'], 0.1, 512);
  await localProvider.generate({ system: '', messages: [{ role: 'user', content: 'x' }] });
  expect(mockNative.generate).toHaveBeenLastCalledWith(expect.any(String), '', 'x', [], 0.2, 0);
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
  expect(logs[0]).toBe('GPU: model load 0 ms, first token 900 ms, total 4000 ms, 4100 tokens in cache');
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

test('download: pinned URL, progress, and the .part file is moved only when the size matches', async () => {
  fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
  let onProgress: (d: { totalBytesWritten: number }) => void = () => {};
  fs.createDownloadResumable.mockImplementation(((_url: string, _to: string, _o: unknown, cb: typeof onProgress) => {
    onProgress = cb;
    return { downloadAsync: async () => { onProgress({ totalBytesWritten: 1000 }); } };
  }) as never);
  present(LITERT_MODEL.size);
  const seen: number[] = [];
  await localModel.download((p) => seen.push(p.loaded));
  expect(fs.createDownloadResumable.mock.calls[0][0]).toBe(
    `https://huggingface.co/${LITERT_MODEL.repo}/resolve/${LITERT_MODEL.revision}/${LITERT_MODEL.file}`);
  expect(seen).toEqual([1000]);
  expect(fs.moveAsync).toHaveBeenCalledWith({ from: `file:///data/models/${LITERT_MODEL.file}.part`, to: `file:///data/models/${LITERT_MODEL.file}` });
});

test('download: a short file is deleted and reported, never moved into place', async () => {
  fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
  fs.createDownloadResumable.mockReturnValue({ downloadAsync: async () => {} } as never);
  present(5);
  await expect(localModel.download(() => {})).rejects.toThrow('did not finish');
  expect(fs.deleteAsync).toHaveBeenCalledWith(`file:///data/models/${LITERT_MODEL.file}.part`, { idempotent: true });
  expect(fs.moveAsync).not.toHaveBeenCalled();
});

test('remove releases the engine and deletes the file and any partial', async () => {
  await localModel.remove();
  expect(mockNative.release).toHaveBeenCalled();
  expect(fs.deleteAsync).toHaveBeenCalledTimes(2);
});
