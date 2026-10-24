import { loadSettings, saveSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const defaults = { provider: 'openrouter', openrouterKey: '', ollamaUrl: 'http://localhost:11434', ollamaModel: '' };

test('settings default, round-trip and survive junk', async () => {
  expect(await loadSettings()).toEqual(defaults);
  const saved = { provider: 'ollama' as const, openrouterKey: 'sk-or-x', ollamaUrl: 'http://192.168.1.5:11434', ollamaModel: 'llama3' };
  await saveSettings(saved);
  expect(await loadSettings()).toEqual(saved);
  await saveSettings({ provider: 'http://evil', openrouterKey: 5, ollamaUrl: 'javascript:alert(1)', ollamaModel: null } as never);
  expect(await loadSettings()).toEqual(defaults);
});

test('settings saved by the old on-device build fall back to OpenRouter', async () => {
  await saveSettings({ provider: 'local', model: 'E2B' } as never);
  expect(await loadSettings()).toEqual(defaults);
});
