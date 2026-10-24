import AsyncStorage from '@react-native-async-storage/async-storage';
import { readJson, removeKey, StorageError, writeJson } from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const kindOf = (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof StorageError ? e.kind : 'other'));

test('missing key is null, not an error', async () => {
  expect(await readJson('k')).toBeNull();
});

test('corrupt JSON is unreadable, failed read is unavailable', async () => {
  await AsyncStorage.setItem('k', '{nope');
  expect(await kindOf(readJson('k'))).toBe('unreadable');
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
  expect(await kindOf(readJson('k'))).toBe('unavailable');
});

test('failed write and remove reject', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  expect(await kindOf(writeJson('k', 1))).toBe('unavailable');
  jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disk'));
  expect(await kindOf(removeKey('k'))).toBe('unavailable');
});
