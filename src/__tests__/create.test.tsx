import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import Create from '@/app/create';
import { mockProvider } from '@/ai/providers/mock';
import { readJson, specKey } from '@/storage';
import { saveSettings } from '@/storage/settings';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDisable = jest.fn();
const mockConfirm = jest.fn();
let mockGuard: { prevent: boolean; ask(o: { repeat(): void }): void } = { prevent: false, ask: () => {} };
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
  usePreventRemove: (prevent: boolean, ask: (o: { repeat(): void }) => void) => { mockGuard = { prevent, ask }; return mockDisable; },
}));
jest.mock('@/capabilities', () => ({ ...jest.requireActual('@/capabilities'), confirm: (...a: unknown[]) => mockConfirm(...a) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockDisable.mockClear();
  mockConfirm.mockReset();
  await saveSettings({ provider: 'mock', ollamaUrl: 'http://localhost:11434', ollamaModel: '', currency: 'USD' });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const type = (text: string) => fireEvent.changeText(screen.getByLabelText('Describe your mini-app'), text);

test('chip → Build → live preview → Save writes a valid spec and opens it', async () => {
  await render(<Create />);
  await fireEvent.press(screen.getByLabelText('Example: Fridge Snap'));
  await fireEvent.press(screen.getByText('Build'));
  expect(await screen.findByText(/Preview · 🧊 Fridge Snap/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Save'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const id = mockReplace.mock.calls[0][0].params.id;
  expect(((await readJson(specKey(id))) as { meta: { name: string } }).meta.name).toBe('Fridge Snap');
});

test('unsupported request shows reason, suggestion and builds the suggestion', async () => {
  await render(<Create />);
  await type('Build me a physics simulator');
  await fireEvent.press(screen.getByText('Build'));
  expect(await screen.findByText(/real-time drawing canvas/)).toBeTruthy();
  expect(screen.getByText(/projectile calculator/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Build the suggestion'));
  await waitFor(() => expect(screen.queryByText('Build the suggestion')).toBeNull());
});

test('AI not set up: status line and Set up AI replace Build', async () => {
  jest.spyOn(mockProvider, 'isConfigured').mockResolvedValue(false);
  await render(<Create />);
  await type('A water tracker');
  expect(await screen.findByText('AI: Mock · not set up yet')).toBeTruthy();
  expect(screen.queryByText('Build')).toBeNull();
  await fireEvent.press(screen.getByText('Set up AI'));
  expect(mockPush).toHaveBeenCalledWith('/settings');
});

test('AI ready: status line and Build, typed prompt kept', async () => {
  await render(<Create />);
  await type('A water tracker');
  expect(await screen.findByText('AI: Mock · ready')).toBeTruthy();
  expect(screen.getByDisplayValue('A water tracker')).toBeTruthy();
  expect(screen.getByText('Build')).toBeTruthy();
});

test('failed save keeps the preview and says so; retry saves and the app reopens intact', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await render(<Create />);
  await fireEvent.press(screen.getByLabelText('Example: Fridge Snap'));
  await fireEvent.press(screen.getByText('Build'));
  await screen.findByText(/Preview · 🧊 Fridge Snap/);
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await fireEvent.press(screen.getByText('Save'));
  expect(await screen.findByText(/Couldn’t save\. Your changes are still open/)).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByText('Save')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  const id = mockReplace.mock.calls[0][0].params.id;
  expect(((await readJson(specKey(id))) as { meta: { name: string } }).meta.name).toBe('Fridge Snap');
});

test('a built preview asks before it is thrown away; Save does not ask', async () => {
  await render(<Create />);
  expect(mockGuard.prevent).toBe(false); // nothing built yet
  await fireEvent.press(screen.getByLabelText('Example: Plant Pal'));
  await fireEvent.press(screen.getByText('Build'));
  await screen.findByText(/Preview · /);
  expect(mockGuard.prevent).toBe(true);

  const repeat = jest.fn();
  mockConfirm.mockResolvedValueOnce(false);
  mockGuard.ask({ repeat });
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  expect(mockConfirm.mock.calls[0][1]).toMatchObject({ title: 'Discard this mini-app?', confirmLabel: 'Discard', destructive: true });
  expect(repeat).not.toHaveBeenCalled(); // kept

  mockConfirm.mockResolvedValueOnce(true);
  mockGuard.ask({ repeat });
  await waitFor(() => expect(repeat).toHaveBeenCalledTimes(1)); // discarded: the blocked Back goes through

  await fireEvent.press(screen.getByText('Save'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  expect(mockDisable).toHaveBeenCalledTimes(1);
  expect(mockDisable.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
});

test('leaving mid-build asks too, in words about stopping the build', async () => {
  process.env.EXPO_PUBLIC_MOCK_DELAY_MS = '150';
  try {
    await render(<Create />);
    await fireEvent.press(screen.getByLabelText('Example: Plant Pal'));
    await fireEvent.press(screen.getByText('Build'));
    expect(mockGuard.prevent).toBe(true); // building, nothing to preview yet

    const repeat = jest.fn();
    mockConfirm.mockResolvedValueOnce(true);
    mockGuard.ask({ repeat });
    await waitFor(() => expect(repeat).toHaveBeenCalledTimes(1));
    expect(mockConfirm.mock.calls[0][1]).toMatchObject({ title: 'Stop building?', confirmLabel: 'Stop building', destructive: true });
    await screen.findByText(/Preview · /); // let the build settle before the test ends
  } finally {
    delete process.env.EXPO_PUBLIC_MOCK_DELAY_MS;
  }
});
