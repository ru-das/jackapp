import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Home from '@/app/index';
import Run from '@/app/run/[id]';
import { toast } from '@/capabilities';
import { createActionEngine } from '@/runtime/actions';
import { Renderer } from '@/runtime/Renderer';
import { createSession } from '@/runtime/session';
import { createStore } from '@/runtime/store';
import { h1 } from '@/spec/fixtures';
import { SpecSchema } from '@/spec/schema';
import { validate } from '@/spec/validate';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: 'security' }),
  Stack: { Screen: () => null },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/capabilities', () => ({ toast: jest.fn() }));
jest.mock('@/runtime/session', () => ({ createSession: jest.fn() }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}

function textSpec(value: string) {
  return {
    specVersion: '0.1', meta: { name: 'Security', description: '', icon: '🔒' },
    state: {} as Record<string, unknown>,
    screens: [{ id: 'main', title: 'Security', root: 'root' }],
    elements: { root: { type: 'Text', props: { value } as Record<string, unknown> } },
    actions: {} as Record<string, unknown>,
  };
}

async function mount(raw: unknown, restore = false) {
  expect(validate(raw)).toEqual([]);
  const spec = SpecSchema.parse(raw);
  const store = createStore('security', spec.state);
  if (restore) await store.load();
  const engine = createActionEngine({ spec, store,
    services: { toast: jest.fn(), share: jest.fn(), confirm: jest.fn(), navigate: jest.fn() },
    getValueContext: () => ({ now: new Date(), locale: 'en-US', timeZone: 'UTC' }),
  });
  return { store, view: await render(createElement(Renderer, { spec, store, engine })) };
}

test('AT-12: src contains no executable-spec APIs', () => {
  const forbidden = /eval\s*\(|new\s+Function\b|dangerouslySetInnerHTML|WebView/;
  const source = files(resolve('src')).filter((file) => file !== __filename);
  expect(source.filter((file) => forbidden.test(readFileSync(file, 'utf8')))).toEqual([]);
});

test.each(['<b>hi</b><script>', '<img src=x onerror="alert(1)">', '<svg onload="alert(1)">'])
('literal Text preserves %s', async (payload) => {
  await mount(textSpec(payload));
  expect(screen.getByText(payload).props.children).toBe(payload);
});

test.each(['<b>hi</b><script>', '<img src=x onerror="alert(1)">'])
('state-expanded Text preserves %s', async (payload) => {
  const raw = textSpec('{{message}}');
  raw.state.message = { type: 'string', default: payload };
  await mount(raw);
  expect(screen.getByText(payload).props.children).toBe(payload);
});

test.each(['WebView', 'Script', 'iframe'])('rejects forbidden component %s', (type) => {
  const raw = textSpec('safe'); raw.elements.root.type = type;
  expect(validate(raw)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_COMPONENT' })]));
});

test.each(['eval', 'fetch', 'script', 'http.request'])('rejects action %s', (op) => {
  const raw = textSpec('safe'); raw.actions.attack = { steps: [{ op, url: 'https://evil.example/' }] };
  expect(validate(raw).length).toBeGreaterThan(0);
});

test.each(['dangerouslySetInnerHTML', 'onClick', 'onError', 'style'])('rejects unknown prop %s', (prop) => {
  const raw = textSpec('safe'); raw.elements.root.props[prop] = 'alert(1)';
  expect(validate(raw)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BAD_PROP' })]));
});

test('rejects malformed JSON and semantically invalid references', () => {
  expect(validate('{broken')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BAD_JSON' })]));
  expect(validate(textSpec('{{undeclared}}')).length).toBeGreaterThan(0);
  const raw = textSpec('safe'); raw.elements.root.type = 'Button';
  raw.elements.root.props = { label: 'Run', onPress: 'missing' };
  expect(validate(raw)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'MISSING_REF' })]));
});

test.each(['https://evil.example/image.png', '//evil.example/image.png', 'javascript:alert(1)'])
('rejects remote image literal and default %s', (url) => {
  const raw = textSpec('safe'); raw.elements.root.type = 'Image'; raw.elements.root.props = { src: url };
  expect(validate(raw).length).toBeGreaterThan(0);
  raw.elements.root.type = 'Text'; raw.elements.root.props = { value: 'safe' };
  raw.state.photo = { type: 'image', default: url };
  expect(validate(raw).length).toBeGreaterThan(0);
});

test('fixture save validates before writing or navigating, with friendly feedback', async () => {
  const original = h1.elements.root.children;
  h1.elements.root.children = ['missing'];
  jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await render(createElement(Home));
    await fireEvent.press(screen.getByLabelText('Open Fridge Snap'));
    expect(await AsyncStorage.getItem('jackapp:spec:fixture-h1')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("can't open"));
  } finally { h1.elements.root.children = original; }
});

test('valid fixture still saves and opens', async () => {
  await render(createElement(Home));
  await fireEvent.press(screen.getByLabelText('Open Fridge Snap'));
  expect(validate(JSON.parse((await AsyncStorage.getItem('jackapp:spec:fixture-h1'))!))).toEqual([]);
  expect(mockPush).toHaveBeenCalled();
});

test.each(['{broken', JSON.stringify(textSpec('{{undeclared}}'))])
('stored invalid spec cannot create a runtime session: %s', async (stored) => {
  await AsyncStorage.setItem('jackapp:spec:security', stored);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await render(createElement(Run));
  expect(await screen.findByText(/couldn't find|damaged/)).toBeTruthy();
  expect(createSession).not.toHaveBeenCalled();
});

test.each(['https://evil.example/photo.jpg', '//evil.example/photo.jpg', 'data:text/html,<script>'])
('persisted image %s reaches neither display component', async (photo) => {
  const raw = {
    ...textSpec('safe'), state: { photo: { type: 'image', default: null } },
    elements: {
      root: { type: 'Stack', props: {}, children: ['input', 'display'] },
      input: { type: 'ImageInput', props: { bind: 'photo', label: 'Photo' } },
      display: { type: 'Image', props: { src: { $ref: 'photo' }, alt: 'Display' } },
    },
  };
  await AsyncStorage.setItem('jackapp:data:security', JSON.stringify({ photo }));
  const { store, view } = await mount(raw, true);
  expect(store.getState().photo).toBeNull();
  expect(screen.queryByLabelText('Photo preview')).toBeNull();
  expect(screen.queryByLabelText('Display')).toBeNull();
  expect(JSON.stringify(view.toJSON())).not.toContain('"uri"');
});

test.each([null, 'data:image/png;base64,aGVsbG8=', 'file:///local/photo.jpg'])
('stored local image %s remains supported', async (photo) => {
  await AsyncStorage.setItem('jackapp:data:security', JSON.stringify({ photo }));
  const store = createStore('security', SpecSchema.parse({ ...textSpec('safe'),
    state: { photo: { type: 'image', default: null } } }).state);
  await store.load();
  expect(store.getState().photo).toBe(photo);
});
