import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings, saveSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const defaults = { provider: 'ollama', ollamaUrl: 'http://localhost:11434', ollamaModel: '', currency: 'USD' };

test('settings default, round-trip and survive junk', async () => {
  expect(await loadSettings()).toEqual(defaults);
  const saved = { provider: 'ollama' as const, ollamaUrl: 'http://192.168.1.5:11434', ollamaModel: 'llama3', currency: 'USD' };
  await saveSettings(saved);
  expect(await loadSettings()).toEqual(saved);
  await saveSettings({ provider: 'http://evil', ollamaUrl: 'javascript:alert(1)', ollamaModel: null } as never);
  expect(await loadSettings()).toEqual(defaults);
});

test("a saved 'local' provider is kept; unknown providers, including a saved 'openrouter' (ADR-049), fall back to the default", async () => {
  await saveSettings({ provider: 'local', model: 'E2B' } as never);
  expect(await loadSettings()).toEqual({ ...defaults, provider: 'local' });
  await saveSettings({ provider: 'gemma-on-device' } as never);
  expect((await loadSettings()).provider).toBe('ollama');
  await saveSettings({ provider: 'openrouter', openrouterKey: 'sk-or-old' } as never);
  expect(await loadSettings()).toEqual(defaults); // the old key is dropped, not carried along
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

test('a fresh install anywhere else starts on Ollama', async () => {
  await AsyncStorage.clear();
  expect((await loadSettings()).provider).toBe('ollama');
});
