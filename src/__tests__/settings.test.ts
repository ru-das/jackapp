import { loadSettings, saveSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('settings default, round-trip and survive junk', async () => {
  expect(await loadSettings()).toEqual({ provider: 'local', model: 'E2B' });
  await saveSettings({ provider: 'mock', model: 'E4B' });
  expect(await loadSettings()).toEqual({ provider: 'mock', model: 'E4B' });
  await saveSettings({ provider: 'http://evil', model: 'X' } as never);
  expect(await loadSettings()).toEqual({ provider: 'local', model: 'E2B' });
});
