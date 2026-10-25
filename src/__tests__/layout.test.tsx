import { render } from '@testing-library/react-native';
import * as RN from 'react-native';
import RootLayout from '@/app/_layout';

let mockOptions: { statusBarStyle?: string } = {};
jest.mock('expo-router', () => {
  const Stack = Object.assign((p: { screenOptions: object }) => { mockOptions = p.screenOptions; return null; }, { Screen: () => null });
  return { Stack, useRouter: () => ({ push: jest.fn() }) };
});
jest.mock('@/capabilities', () => ({ onNotificationOpen: () => () => {}, registerOffline: () => () => {}, subscribeToast: () => () => {} }));

afterEach(() => jest.restoreAllMocks());

test.each([['light', 'dark'], ['dark', 'light']] as const)('%s theme draws %s status bar icons', async (scheme, icons) => {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(scheme);
  await render(<RootLayout />);
  expect(mockOptions.statusBarStyle).toBe(icons);
});
