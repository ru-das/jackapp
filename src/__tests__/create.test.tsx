import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Create from '@/app/create';
import { mockProvider } from '@/ai/providers/mock';
import { readJson, specKey } from '@/storage';
import { saveSettings } from '@/storage/settings';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  mockReplace.mockClear();
  mockPush.mockClear();
  await saveSettings({ provider: 'mock', model: 'E2B' });
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

test('model missing: friendly card pointing to settings', async () => {
  jest.spyOn(mockProvider, 'status').mockReturnValue('unloaded');
  jest.spyOn(mockProvider, 'isDownloaded').mockResolvedValue(false);
  await render(<Create />);
  await type('A water tracker');
  await fireEvent.press(screen.getByText('Build'));
  expect(await screen.findByText('Download a model first')).toBeTruthy();
  await fireEvent.press(screen.getByText('Open settings'));
  expect(mockPush).toHaveBeenCalledWith('/settings');
});
