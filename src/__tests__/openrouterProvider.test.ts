import { OPENROUTER_FALLBACKS, OPENROUTER_MODELS } from '@/ai/models';
import { openrouterProvider } from '@/ai/providers/openrouter';
import { saveSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const settings = { provider: 'openrouter' as const, openrouterKey: ' sk-or-test ', ollamaUrl: 'http://localhost:11434', ollamaModel: '' };
const ok = (content: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ choices: [{ message: { content } }] }) });
const fail = (status: number, headers: Record<string, string> = {}) =>
  ({ ok: false, status, headers: new Headers(headers), json: async () => ({ error: { message: 'x' } }) });
const sent = (fetchMock: jest.Mock, n = 0) => JSON.parse(fetchMock.mock.calls[n][1].body);

let fetchMock: jest.Mock;
beforeEach(async () => {
  await saveSettings(settings);
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as never;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('sends the stage model with a fallback, the key, and no schema unless given', async () => {
  fetchMock.mockResolvedValue(ok(' {"a":1} '));
  const out = await openrouterProvider.generate({ system: 'S', messages: [{ role: 'user', content: 'hi' }], stage: 'repair', maxTokens: 9, temperature: 0.1 });
  expect(out).toBe('{"a":1}');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(init.headers.Authorization).toBe('Bearer sk-or-test');
  expect(sent(fetchMock)).toEqual({
    models: [OPENROUTER_MODELS.repair, ...OPENROUTER_FALLBACKS],
    reasoning: { effort: 'low' },
    messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'hi' }],
    max_tokens: 9, temperature: 0.1,
  });
});

test('defaults to the fill model; schema becomes response_format; images become image_url parts', async () => {
  fetchMock.mockResolvedValue(ok('{}'));
  const schema = { type: 'object' };
  await openrouterProvider.generate({ system: '', jsonSchema: schema, messages: [{ role: 'user', content: 'x', images: ['data:image/png;base64,AA=='] }] });
  const body = sent(fetchMock);
  expect(body.models[0]).toBe(OPENROUTER_MODELS.fill);
  expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'out', strict: true, schema } });
  expect(body.messages[1].content).toEqual([
    { type: 'text', text: 'x' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
  ]);
});

test('no key: friendly error and no request', async () => {
  await saveSettings({ ...settings, openrouterKey: ' ' });
  expect(await openrouterProvider.isConfigured()).toBe(false);
  await expect(openrouterProvider.generate({ system: '', messages: [] })).rejects.toThrow('Settings');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('401 says to check the key', async () => {
  fetchMock.mockResolvedValue(fail(401));
  await expect(openrouterProvider.generate({ system: '', messages: [] })).rejects.toThrow('did not accept your key');
});

test('429 retries honoring retry-after, then succeeds', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValueOnce(fail(429, { 'retry-after': '3' })).mockResolvedValueOnce(ok('{}'));
  const p = openrouterProvider.generate({ system: '', messages: [] });
  await jest.advanceTimersByTimeAsync(3000);
  await expect(p).resolves.toBe('{}');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('429 forever gives the busy message after 4 tries', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue(fail(429));
  const p = openrouterProvider.generate({ system: '', messages: [] });
  const check = expect(p).rejects.toThrow('busy');
  await jest.advanceTimersByTimeAsync(60_000);
  await check;
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test('abort during the wait stops retrying', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue(fail(429, { 'retry-after': '10' }));
  const c = new AbortController();
  const p = openrouterProvider.generate({ system: '', messages: [], signal: c.signal });
  const check = expect(p).rejects.toThrow('aborted');
  await jest.advanceTimersByTimeAsync(100);
  c.abort();
  await check;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('network failure and empty content give friendly errors', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(openrouterProvider.generate({ system: '', messages: [] })).rejects.toThrow("Can't reach OpenRouter");
  fetchMock.mockResolvedValueOnce({ ...ok(null), json: async () => ({ model: 'm/x', choices: [{ finish_reason: 'length', message: { content: null } }] }) });
  await expect(openrouterProvider.generate({ system: '', messages: [] })).rejects.toThrow('200, m/x: no text, finish_reason length');
});
