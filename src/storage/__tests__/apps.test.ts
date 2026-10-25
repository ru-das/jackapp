import AsyncStorage from '@react-native-async-storage/async-storage';
import { h1 } from '@/spec/fixtures';
import { dataKey, readJson, specKey, writeJson } from '..';
import { deleteApp, duplicateApp, listApps, renameApp } from '../apps';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => { await AsyncStorage.clear(); });

test('lists user apps newest first, hides fixtures, flags damaged specs', async () => {
  await writeJson(specKey('app-1'), h1);
  await writeJson(specKey('app-2'), h1);
  await writeJson(specKey('fixture-h1'), h1);
  await writeJson(specKey('app-3'), { nope: true });
  const apps = await listApps();
  expect(apps.map((a) => a.id)).toEqual(['app-3', 'app-2', 'app-1']);
  expect(apps[0].damaged).toBe(true);
});

test('rename validates and writes; blank names are refused', async () => {
  await writeJson(specKey('app-1'), h1);
  expect(await renameApp('app-1', '  Pantry  ')).toBe(true);
  expect((await listApps())[0].name).toBe('Pantry');
  expect(await renameApp('app-1', '   ')).toBe(false);
  expect(await renameApp('app-1', 'x'.repeat(41))).toBe(false);
});

test('duplicate copies the spec, not the data', async () => {
  await writeJson(specKey('app-1'), h1);
  await writeJson(dataKey('app-1'), { items: [1] });
  const id = await duplicateApp('app-1', (n) => `${n} (copy)`);
  expect(id).toMatch(/^app-/);
  expect(await readJson(dataKey(id!))).toBeNull();
  expect((await listApps()).map((a) => a.name)).toContain(`${h1.meta.name} (copy)`);
});

test('duplicate with data copies the data too', async () => {
  await writeJson(specKey('app-1'), h1);
  await writeJson(dataKey('app-1'), { items: [1] });
  const id = await duplicateApp('app-1', (n) => n, true);
  expect(await readJson(dataKey(id!))).toEqual({ items: [1] });
});

test('delete removes spec and data', async () => {
  await writeJson(specKey('app-1'), h1);
  await writeJson(dataKey('app-1'), { a: 1 });
  await deleteApp('app-1');
  expect(await listApps()).toEqual([]);
  expect(await readJson(dataKey('app-1'))).toBeNull();
});

test('rename and duplicate report a failed write instead of success', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await writeJson(specKey('app-1'), h1);
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  expect(await renameApp('app-1', 'Pantry')).toBe(false);
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  expect(await duplicateApp('app-1', (n) => n)).toBeNull();
  expect((await listApps())[0].name).toBe(h1.meta.name);
  jest.restoreAllMocks();
});

test('listApps rejects when storage is unavailable, flags only corrupt rows', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await AsyncStorage.setItem(specKey('app-1'), '{nope');
  expect((await listApps())[0].damaged).toBe(true);
  jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('disk'));
  await expect(listApps()).rejects.toThrow();
  jest.restoreAllMocks();
});
