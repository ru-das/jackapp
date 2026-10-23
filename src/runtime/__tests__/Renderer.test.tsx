import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { h1 } from '@/spec/fixtures';
import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { createActionEngine } from '../actions';
import { Renderer, type RendererHandle } from '../Renderer';
import { createStore } from '../store';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

function mount(raw: unknown, seed: Record<string, unknown> = {}) {
  expect(validate(raw)).toEqual([]);
  const spec: Spec = SpecSchema.parse(raw);
  const store = createStore('t', spec.state);
  store.setState(seed);
  const services = { share: jest.fn(), toast: jest.fn(), confirm: jest.fn(async () => true), navigate: jest.fn() };
  const engine = createActionEngine({
    spec, store, services,
    getValueContext: () => ({ now: new Date(), locale: 'en-US', timeZone: 'UTC' }),
  });
  let handle!: RendererHandle;
  const ui = <Renderer spec={spec} store={store} engine={engine} onReady={(h) => { handle = h; }} />;
  return { ui, store, services, handle: () => handle };
}

let err: jest.SpyInstance, warn: jest.SpyInstance;
beforeEach(() => { err = jest.spyOn(console, 'error'); warn = jest.spyOn(console, 'warn'); });
afterEach(() => jest.restoreAllMocks());

test('AT-04: H1 type, tick, delete update state and UI with no console noise', async () => {
  const f = mount(h1, { items: [{ name: 'Eggs', qty: '6', done: false }, { name: 'Milk', qty: '1 L', done: false }] });
  await render(f.ui);
  expect(screen.getByText('Eggs')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Anything to add?'), 'out of tea');
  expect(f.store.getState().notes).toBe('out of tea');
  expect(screen.getByDisplayValue('out of tea')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Eggs'));
  expect((f.store.getState().items as { done: boolean }[])[0].done).toBe(true);
  expect(screen.getByLabelText('Eggs').props.accessibilityState.checked).toBe(true);

  await fireEvent.press(screen.getByLabelText('Delete Milk'));
  expect(f.store.getState().items).toEqual([{ name: 'Eggs', qty: '6', done: true }]);
  expect(screen.queryByText('Milk')).toBeNull();

  expect(err).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});

test('button runs its action; clearDone confirm removes ticked items', async () => {
  const f = mount(h1, { items: [{ name: 'Eggs', qty: '6', done: true }, { name: 'Milk', qty: '1', done: false }] });
  await render(f.ui);
  await act(async () => { await fireEvent.press(screen.getByLabelText('Clear bought items')); });
  expect(f.services.confirm).toHaveBeenCalled();
  expect((f.store.getState().items as unknown[]).length).toBe(1);
});

test('a broken element shows the "this part broke" card and siblings survive', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const bad = structuredClone(h1) as Record<string, any>;
  bad.elements.notesIn.type = 'Timer'; // valid for the validator, no renderer until T-55
  bad.elements.notesIn.props = { seconds: 5, label: 'x' };
  const spec: Spec = SpecSchema.parse(bad);
  const store = createStore('t', spec.state);
  const engine = createActionEngine({ spec, store,
    services: { share: jest.fn(), toast: jest.fn(), confirm: jest.fn(), navigate: jest.fn() },
    getValueContext: () => ({ now: new Date(), locale: 'en-US', timeZone: 'UTC' }) });
  await render(<Renderer spec={spec} store={store} engine={engine} />);
  expect(screen.getByText(/This bit dozed off/)).toBeTruthy();
  expect(screen.getByText('Grocery list')).toBeTruthy();
});

test('navigate switches screens and Back returns', async () => {
  const two = structuredClone(h1) as Record<string, any>;
  two.screens.push({ id: 'second', title: 'Second', root: 'only' });
  two.elements.only = { type: 'Text', props: { value: 'Second screen' } };
  const f = mount(two);
  await render(f.ui);
  await act(async () => { f.handle().navigate('second'); });
  expect(screen.getByText('Second screen')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(screen.getByText('Grocery list')).toBeTruthy();
});
