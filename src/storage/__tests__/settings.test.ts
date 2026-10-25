import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSettings, preferredCurrency, saveSettings, SETTINGS_KEY } from '../settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(() => AsyncStorage.clear());

test('currency defaults to USD, ignores junk, and round-trips a saved choice', async () => {
  expect((await loadSettings()).currency).toBe('USD');
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ currency: 'rupees' }));
  expect((await loadSettings()).currency).toBe('USD');
  await saveSettings({ ...(await loadSettings()), currency: 'INR' });
  expect(preferredCurrency()).toBe('INR');
  expect((await loadSettings()).currency).toBe('INR');
});
