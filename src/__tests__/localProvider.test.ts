import { localProvider } from '../ai/providers/local.native';
import { getProvider } from '../ai/provider';
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const mockCompletion = jest.fn(async () => ({ text: ' {"a":1} ', timings: { predicted_per_second: 9 } }));
const mockStop = jest.fn();
jest.mock('llama.rn', () => ({
  initLlama: jest.fn(async () => ({
    initMultimodal: async () => true,
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
