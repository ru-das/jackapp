import { act, render, waitFor } from '@testing-library/react-native';
import * as RN from 'react-native';
import RootLayout from '@/app/_layout';
import { loadSettings, saveSettings } from '@/storage/settings';
import { setThemePreference } from '@/ui/theme';

let mockOptions: { statusBarStyle?: string } = {};
jest.mock('expo-router', () => {
  const Stack = Object.assign((p: { screenOptions: object }) => { mockOptions = p.screenOptions; return null; }, { Screen: () => null });
  return { Stack, useRouter: () => ({ push: jest.fn() }) };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let mockFontsReady = true;
jest.mock('expo-font', () => ({ useFonts: () => [mockFontsReady] }));
jest.mock('@/capabilities', () => ({ onNotificationOpen: () => () => {}, registerOffline: () => () => {}, subscribeToast: () => () => {} }));

afterEach(() => { jest.restoreAllMocks(); mockFontsReady = true; mockOptions = {}; });

test.each([['light', 'dark'], ['dark', 'light']] as const)('%s theme draws %s status bar icons', async (scheme, icons) => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
  await render(<RootLayout />);
  expect(mockOptions.statusBarStyle).toBe(icons);
});

test('the saved Appearance choice beats the system scheme', async () => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
  await saveSettings({ ...(await loadSettings()), theme: 'dark' });
  await render(<RootLayout />);
  await waitFor(() => expect(mockOptions.statusBarStyle).toBe('light'));
  await act(async () => { setThemePreference('light'); });
  expect(mockOptions.statusBarStyle).toBe('dark');
  await act(async () => { setThemePreference('system'); });
});

test('on native the stack waits for the fonts, so no text is drawn in the wrong family', async () => {
  mockFontsReady = false;
  await render(<RootLayout />);
  expect(mockOptions.statusBarStyle).toBeUndefined();
});
