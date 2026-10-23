import { localProvider } from '../ai/providers/local.native';
import { getProvider } from '../ai/provider';
import { MODELS, ggufBytes } from '../ai/models';
import { initLlama } from 'llama.rn';
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockCompletion = jest.fn(async () => ({ text: ' {"a":1} ', timings: { predicted_per_second: 9 } }));
const mockStop = jest.fn();
const mockInitMultimodal = jest.fn(async () => true);
jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async () => ({
    initMultimodal: mockInitMultimodal,
    getMultimodalSupport: async () => ({ vision: true }),
    release: jest.fn(),
    completion: mockCompletion,
    stopCompletion: mockStop,
  })),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(async (p: string) => ({ exists: true, size: p.includes('mmproj') ? 985_654_080 : 3_041_378_400 })),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  createDownloadResumable: jest.fn(() => {
    throw new Error('should not download');
  }),
}));

test('mock provider returns JSON and honors abort', async () => {
  const m = getProvider('mock');
  expect(JSON.parse(await m.generate({ system: '', messages: [] }))).toEqual({ ok: true });
  const ac = new AbortController();
  ac.abort();
  await expect(m.generate({ system: '', messages: [], signal: ac.signal })).rejects.toThrow();
});

test('local: skips download when files exist, maps schema + images', async () => {
  await localProvider.load();
  expect(localProvider.status()).toBe('ready');
  const out = await localProvider.generate({
    system: 'sys',
    messages: [{ role: 'user', content: 'hi', images: ['data:image/jpeg;base64,AA'] }],
    jsonSchema: { type: 'object' },
  });
  expect(out).toBe('{"a":1}');
  const arg = (mockCompletion.mock.calls[0] as unknown[])[0] as any;
  expect(arg.response_format.json_schema.schema).toEqual({ type: 'object' });
  expect(arg.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AA' } });
  expect(arg.enable_thinking).toBe(false);
});

test('local: abort calls mockStop', async () => {
  const ac = new AbortController();
  mockCompletion.mockImplementationOnce(async () => {
    ac.abort();
    return { text: '', timings: { predicted_per_second: 0 } };
  });
  await expect(localProvider.generate({ system: '', messages: [], signal: ac.signal })).rejects.toThrow('aborted');
  expect(mockStop).toHaveBeenCalled();
});

test('local: model switch uses E4B files, remove deletes them', async () => {
  const FS = jest.requireMock('expo-file-system/legacy');
  FS.getInfoAsync.mockImplementation(async () => ({ exists: false }));
  await localProvider.setModel('E4B');
  expect(localProvider.status()).toBe('unloaded');
  expect(await localProvider.isDownloaded()).toBe(false);
  await localProvider.remove();
  expect(FS.deleteAsync).toHaveBeenCalledWith('file:///doc/models/E4B-gemma-4-E4B-it-Q4_0.gguf', { idempotent: true });
});

test('local: Qwen downloads its exact quant + projector, keeps GPU offload, and removes only its files', async () => {
  const FS = jest.requireMock('expo-file-system/legacy');
  const stored = new Map<string, number>();
  const model = MODELS['Qwen3.5-2B'];
  FS.getInfoAsync.mockImplementation(async (p: string) => ({ exists: stored.has(p), size: stored.get(p) }));
  FS.createDownloadResumable.mockImplementation((url: string, dest: string) => ({
    downloadAsync: async () => {
      const file = model.gguf.files.find((f) => url.endsWith(`/${f.name}`));
      if (!file) throw new Error(`Unexpected download: ${url}`);
      stored.set(dest, file.size);
    },
  }));
  FS.moveAsync.mockImplementation(async ({ from, to }: { from: string; to: string }) => {
    stored.set(to, stored.get(from)!);
    stored.delete(from);
  });
  await localProvider.setModel('Qwen3.5-2B');
  expect(await localProvider.isDownloaded()).toBe(false);
  const progress = jest.fn();
  await localProvider.load(progress);
  expect(FS.createDownloadResumable).toHaveBeenCalledTimes(2);
  for (const file of model.gguf.files) {
    expect(FS.createDownloadResumable).toHaveBeenCalledWith(
      `https://huggingface.co/${model.gguf.repo}/resolve/main/${file.name}`,
      `file:///doc/models/Qwen3.5-2B-${file.name}.part`, {}, expect.any(Function));
  }
  expect(progress).toHaveBeenLastCalledWith({ loaded: 1_949_063_104, total: ggufBytes('Qwen3.5-2B') });
  expect(await localProvider.isDownloaded()).toBe(true);
  expect(initLlama).toHaveBeenLastCalledWith(expect.objectContaining({
    model: 'file:///doc/models/Qwen3.5-2B-Qwen3.5-2B-Q4_K_M.gguf', n_gpu_layers: 99,
  }));
  expect(mockInitMultimodal).toHaveBeenLastCalledWith(expect.objectContaining({
    path: 'file:///doc/models/Qwen3.5-2B-mmproj-F16.gguf', use_gpu: true,
  }));
  await localProvider.generate({ system: 'JSON only', messages: [{ role: 'user', content: 'Build a list' }] });
  expect(mockCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ enable_thinking: false }));
  FS.deleteAsync.mockClear();
  await localProvider.remove();
  expect(FS.deleteAsync).toHaveBeenCalledTimes(4);
  expect(FS.deleteAsync.mock.calls.every(([p]: [string]) => p.includes('/Qwen3.5-2B-'))).toBe(true);
});
