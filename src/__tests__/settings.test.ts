import AsyncStorage from '@react-native-async-storage/async-storage';
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

// ADR-022 brings 'local' back as the on-device provider, so the T-49 "falls back to OpenRouter" case no longer applies.
test("a saved 'local' provider is kept; unknown providers still fall back to OpenRouter", async () => {
  await saveSettings({ provider: 'local', model: 'E2B' } as never);
  expect(await loadSettings()).toEqual({ ...defaults, provider: 'local' });
  await saveSettings({ provider: 'gemma-on-device' } as never);
  expect((await loadSettings()).provider).toBe('openrouter');
});

test('a fresh Android install starts on-device', async () => {
  await AsyncStorage.clear();
  let load!: typeof loadSettings;
  jest.isolateModules(() => {
    // Platform.OS is read when the schema is built, so the module has to load fresh under the new value.
    /* eslint-disable @typescript-eslint/no-require-imports */
    require('react-native').Platform.OS = 'android';
    load = require('@/storage/settings').loadSettings;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  expect((await load()).provider).toBe('local');
});

test('a fresh install anywhere else starts on OpenRouter', async () => {
  await AsyncStorage.clear();
  expect((await loadSettings()).provider).toBe('openrouter');
});
