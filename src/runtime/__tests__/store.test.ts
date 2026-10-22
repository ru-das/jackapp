import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from '../store';
import type { Spec } from '@/spec/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const decls = {
  name: { type: 'string', default: 'x', persist: true },
  draft: { type: 'string', default: '', persist: false },
  items: { type: 'list', default: [], persist: true },
  photo: { type: 'image', default: null, persist: true },
} as unknown as Spec['state'];
const KEY = 'jackapp:data:a1';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');

beforeEach(async () => { jest.useFakeTimers(); await AsyncStorage.clear(); });
afterEach(() => jest.useRealTimers());

test('starts from declared defaults', () => {
  expect(createStore('a1', decls).getState()).toEqual({ name: 'x', draft: '', items: [], photo: null });
});

test('debounces 500 ms, coalesces, skips persist:false', async () => {
  const s = createStore('a1', decls);
  s.setState({ name: 'a', draft: 'tmp' });
  s.setState({ name: 'b' });
  await jest.advanceTimersByTimeAsync(499);
  expect(await stored()).toBeNull();
  await jest.advanceTimersByTimeAsync(1);
  expect(await stored()).toEqual({ name: 'b', items: [], photo: null });
});

test('AT-05: reopen restores persisted keys, resets persist:false', async () => {
  const s = createStore('a1', decls);
  s.setState({ name: 'kept', draft: 'gone', items: [{ t: 1 }] });
  await s.flush();
  const reopened = createStore('a1', decls);
  await reopened.load();
  expect(reopened.getState()).toEqual({ name: 'kept', draft: '', items: [{ t: 1 }], photo: null });
});

test('ignores undeclared, persist:false and mistyped stored values', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify({ name: 5, draft: 'z', evil: 1, items: [1], __proto__: { x: 1 } }));
  const s = createStore('a1', decls);
  await s.load();
  expect(s.getState()).toEqual({ name: 'x', draft: '', items: [1], photo: null });
});

test('garbage storage leaves defaults', async () => {
  await AsyncStorage.setItem(KEY, '{nope');
  const s = createStore('a1', decls);
  await s.load();
  expect(s.getState().name).toBe('x');
});

test('notifies subscribers and supports updater fn', () => {
  const s = createStore('a1', decls);
  const fn = jest.fn();
  const off = s.subscribe(fn);
  s.setState((st) => ({ name: `${st.name}!` }));
  expect(fn).toHaveBeenCalledTimes(1);
  expect(s.getState().name).toBe('x!');
  off();
  s.setState({ name: 'q' });
  expect(fn).toHaveBeenCalledTimes(1);
});
