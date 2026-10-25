import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect as mockUseEffect } from 'react';
import Create from '@/app/create';
import { mockProvider } from '@/ai/providers/mock';
import { readJson, specKey } from '@/storage';
import { saveSettings } from '@/storage/settings';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  await saveSettings({ provider: 'mock', openrouterKey: '', ollamaUrl: 'http://localhost:11434', ollamaModel: '', currency: 'USD' });
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
