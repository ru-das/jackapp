import { ollamaProvider } from '@/ai/providers/ollama';
import { saveSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const settings = { provider: 'ollama' as const, openrouterKey: '', ollamaUrl: 'http://192.168.1.5:11434/', ollamaModel: ' llama3 ' };
const ok = (content: unknown) => ({ ok: true, status: 200, json: async () => ({ message: { content } }) });

let fetchMock: jest.Mock;
beforeEach(async () => {
  await saveSettings(settings);
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as never;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('posts to /api/chat with the model, schema, options and bare base64 images', async () => {
  fetchMock.mockResolvedValue(ok(' {"a":1} '));
  const schema = { type: 'object' };
  const out = await ollamaProvider.generate({
    system: 'S', jsonSchema: schema, maxTokens: 50, temperature: 0.2,
    messages: [{ role: 'user', content: 'x', images: ['data:image/jpeg;base64,QUJD'] }],
  });
  expect(out).toBe('{"a":1}');
  expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.1.5:11434/api/chat');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    model: 'llama3', stream: false, format: schema, options: { temperature: 0.2, num_predict: 50 },
    messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'x', images: ['QUJD'] }],
  });
});

test('no model name: not configured, friendly error, no request', async () => {
  await saveSettings({ ...settings, ollamaModel: '' });
  expect(await ollamaProvider.isConfigured()).toBe(false);
  await expect(ollamaProvider.generate({ system: '', messages: [] })).rejects.toThrow('model name');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('unreachable server and unknown model give friendly errors', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  await expect(ollamaProvider.generate({ system: '', messages: [] })).rejects.toThrow("Can't reach Ollama at http://192.168.1.5:11434");
  fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'model not found' }) });
  await expect(ollamaProvider.generate({ system: '', messages: [] })).rejects.toThrow('no model called');
});
