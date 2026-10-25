import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Customize from '@/app/edit/[id]';
import { RECIPES } from '@/ai/generator/recipes';
import { readSettings, writeSettings } from '@/ai/generator/recipes/settings';
import { specKey, writeJson } from '@/storage';

const mockBack = jest.fn();
const mockDisable = jest.fn();
const mockConfirm = jest.fn();
let mockGuard: { prevent: boolean; ask(o: { repeat(): void }): void } = { prevent: false, ask: () => {} };
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'a1' }),
  Stack: { Screen: () => null },
  usePreventRemove: (prevent: boolean, ask: (o: { repeat(): void }) => void) => { mockGuard = { prevent, ask }; return mockDisable; },
}));
jest.mock('@/capabilities', () => ({
  confirm: (...a: unknown[]) => mockConfirm(...a), toast: jest.fn(), cancelTriggers: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  jest.clearAllMocks();
  mockConfirm.mockReset();
  await AsyncStorage.clear();
  const settings = readSettings(RECIPES.counter.example.reply);
  const spec = RECIPES.counter.make(settings, 'Water counter') as { meta: Record<string, unknown> };
  spec.meta.recipe = { id: 'counter', version: RECIPES.counter.version, settings: writeSettings(settings) };
  await writeJson(specKey('a1'), spec);
});

test('untouched settings leave freely; an edit asks before Back throws it away', async () => {
  await render(<Customize />);
  const field = await screen.findByLabelText('Add this much each time');
  expect(mockGuard.prevent).toBe(false);

  await fireEvent.changeText(field, '3');
  expect(mockGuard.prevent).toBe(true);

  const repeat = jest.fn();
  mockConfirm.mockResolvedValueOnce(false);
  mockGuard.ask({ repeat });
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  expect(mockConfirm.mock.calls[0][1]).toMatchObject({ title: 'Discard your changes?', confirmLabel: 'Discard', destructive: true });
  expect(repeat).not.toHaveBeenCalled();

  mockConfirm.mockResolvedValueOnce(true);
  mockGuard.ask({ repeat });
  await waitFor(() => expect(repeat).toHaveBeenCalledTimes(1));
});

test('putting the old value back is not a change', async () => {
  await render(<Customize />);
  const field = await screen.findByLabelText('Add this much each time');
  await fireEvent.changeText(field, '3');
  await fireEvent.changeText(field, '1');
  expect(mockGuard.prevent).toBe(false);
});

test('Save lifts the guard before going back, so saving never asks to discard', async () => {
  await render(<Customize />);
  await fireEvent.changeText(await screen.findByLabelText('Add this much each time'), '2');
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(mockBack).toHaveBeenCalled());
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(mockDisable.mock.invocationCallOrder[0]).toBeLessThan(mockBack.mock.invocationCallOrder[0]);
});
