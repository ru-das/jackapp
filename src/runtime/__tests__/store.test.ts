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

describe('save failures', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('failed write stays pending, flush retries, data survives reopen', async () => {
    const onError = jest.fn();
    const s = createStore('a1', decls, onError);
    s.setState({ name: 'kept' });
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(s.flush()).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(await stored()).toBeNull();
    await s.flush();
    const reopened = createStore('a1', decls);
    await reopened.load();
    expect(reopened.getState().name).toBe('kept');
  });

  test('failed autosave is reported and retried by the next flush', async () => {
    const onError = jest.fn();
    const s = createStore('a1', decls, onError);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    s.setState({ name: 'a' });
    await jest.advanceTimersByTimeAsync(500);
    expect(onError).toHaveBeenCalledTimes(1);
    await s.flush();
    expect((await stored()).name).toBe('a');
  });

  test('flush waits for a write already in progress', async () => {
    const s = createStore('a1', decls);
    let release!: () => void;
    const real = AsyncStorage.setItem.bind(AsyncStorage);
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(
      (k, v) => new Promise((res) => { release = () => res(real(k, v)); }),
    );
    s.setState({ name: 'slow' });
    await jest.advanceTimersByTimeAsync(500); // autosave now in flight
    let done = false;
    const f = s.flush().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await f;
    expect((await stored()).name).toBe('slow');
  });

  test('load rejects when storage is unavailable instead of opening empty', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(createStore('a1', decls).load()).rejects.toThrow();
  });
});

describe('undo', () => {
  test('restores removed rows and clears itself', () => {
    const store = createStore('a1', decls);
    store.setState({ items: [1, 2, 3] });
    expect(store.lastRemoval()).toBeNull();
    store.setState({ items: [1] });
    expect(store.lastRemoval()).toMatchObject({ key: 'items', removed: 2 });
    expect(store.undo()).toBe(true);
    expect(store.getState().items).toEqual([1, 2, 3]);
    expect(store.lastRemoval()).toBeNull();
    expect(store.undo()).toBe(false);
  });
  test('a later change to the same list clears it; other keys do not', () => {
    const store = createStore('a1', decls);
    store.setState({ items: [1, 2] });
    store.setState({ items: [1] });
    store.setState({ name: 'y' });
    expect(store.lastRemoval()).not.toBeNull();
    store.setState({ items: [1, 5] });
    expect(store.lastRemoval()).toBeNull();
  });
});
