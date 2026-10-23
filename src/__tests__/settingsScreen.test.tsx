import { fireEvent, render, screen } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { loadSettings, saveSettings } from '@/storage/settings';
import { mockProvider } from '@/ai/providers/mock';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/ai/provider', () => ({ getProvider: () => jest.requireActual('@/ai/providers/mock').mockProvider }));
jest.mock('@/capabilities', () => ({ confirm: jest.fn(async () => true) }));

afterEach(() => jest.restoreAllMocks());

test('Settings lists Gemma and Qwen, persists selection, and restores it before checking downloads', async () => {
  await saveSettings({ provider: 'local', model: 'E2B' });
  const select = jest.spyOn(mockProvider, 'setModel');
  jest.spyOn(mockProvider, 'isDownloaded').mockResolvedValue(false);
  const view = await render(<SettingsScreen />);
  expect(await screen.findByLabelText('Gemma 4 E2B, 4.0 GB')).toBeTruthy();
  expect(screen.getByLabelText('Gemma 4 E4B, 5.8 GB')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Qwen3.5-2B, 1.9 GB'));
  expect(await loadSettings()).toEqual({ provider: 'local', model: 'Qwen3.5-2B' });
  expect(select).toHaveBeenLastCalledWith('Qwen3.5-2B');
  await view.unmount();
  select.mockClear();
  const load = jest.spyOn(mockProvider, 'load');
  await render(<SettingsScreen />);
  expect(await screen.findByRole('radio', { name: 'Qwen3.5-2B, 1.9 GB', selected: true })).toBeTruthy();
  expect(select).toHaveBeenCalledWith('Qwen3.5-2B');
  await fireEvent.press(screen.getByText('Download model'));
  expect(load).toHaveBeenCalled();
});
