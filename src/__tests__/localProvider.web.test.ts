import { NO_GPU_NOTICE } from '../ai/providers/local.web';

type L = (e: { data: unknown }) => void;
let posted: any[];
let device: 'webgpu' | 'wasm';
let failLoad = false;

class FakeWorker {
  ls = new Set<L>();
  addEventListener(t: string, l: L) {
    if (t === 'message') this.ls.add(l);
  }
  removeEventListener(_: string, l: L) {
    this.ls.delete(l);
  }
  terminate() {}
  emit(data: unknown) {
    [...this.ls].forEach((l) => l({ data }));
  }
  postMessage(m: any) {
    posted.push(m);
    queueMicrotask(() => {
      if (m.type === 'load') {
        if (failLoad) return this.emit({ type: 'error', message: 'boom' });
        this.emit({ type: 'progress', loaded: 1, total: 2 });
        this.emit({ type: 'ready', device });
      } else if (m.type === 'generate') this.emit({ type: 'done', id: m.id, text: ' {"a":1} ', tokensPerSec: 7 });
    });
  }
}

const fresh = () => {
  jest.resetModules();
  posted = [];
  (globalThis as any).Worker = FakeWorker;
  (globalThis as any).alert = jest.fn();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- need a fresh module per test
  return require('../ai/providers/local.web') as typeof import('../ai/providers/local.web');
};

test('load forwards progress; wasm notice shows once', async () => {
  device = 'wasm';
  failLoad = false;
  const { localProvider } = fresh();
  const p = jest.fn();
  await localProvider.load(p);
  await localProvider.load();
  expect(p).toHaveBeenCalledWith({ loaded: 1, total: 2 });
  expect(localProvider.status()).toBe('ready');
  expect((globalThis as any).alert).toHaveBeenCalledTimes(1);
  expect((globalThis as any).alert).toHaveBeenCalledWith(NO_GPU_NOTICE);
});

test('webgpu: no notice; generate sends messages + images, returns trimmed text', async () => {
  device = 'webgpu';
  const { localProvider, lastTimings } = fresh();
  await localProvider.load();
  expect((globalThis as any).alert).not.toHaveBeenCalled();
  const out = await localProvider.generate({
    system: 'sys',
    messages: [{ role: 'user', content: 'hi', images: ['data:image/jpeg;base64,AA'] }],
    jsonSchema: { type: 'object' },
  });
  expect(out).toBe('{"a":1}');
  expect(lastTimings.tokensPerSec).toBe(7);
  const g = posted.find((m) => m.type === 'generate');
  expect(g.system).toBe('sys');
  expect(g.messages[0].images).toEqual(['data:image/jpeg;base64,AA']);
  expect(g.jsonSchema).toBeUndefined();
});

test('abort posts abort and rejects', async () => {
  device = 'webgpu';
  const { localProvider } = fresh();
  await localProvider.load();
  const ac = new AbortController();
  const gen = localProvider.generate({ system: '', messages: [], signal: ac.signal });
  await Promise.resolve();
  ac.abort();
  await expect(gen).rejects.toThrow('aborted');
  expect(posted.some((m) => m.type === 'abort')).toBe(true);
});

test('worker error gives friendly message and error status', async () => {
  device = 'webgpu';
  failLoad = true;
  const { localProvider } = fresh();
  await expect(localProvider.load()).rejects.toThrow("This browser can't run the model");
  expect(localProvider.status()).toBe('error');
});
