import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { loadSettings } from '@/storage/settings';
import { setThemePreference } from '@/ui/theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('OpenRouter is no longer offered', async () => {
  await render(<SettingsScreen />);
  await screen.findByLabelText('Ollama (your own computer)');
  expect(screen.queryByText(/OpenRouter/)).toBeNull();
});

test('switching to Ollama saves the address and model', async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(await screen.findByLabelText('Ollama (your own computer)'));
  await fireEvent.changeText(screen.getByLabelText('Ollama server address'), 'http://192.168.1.5:11434');
  await fireEvent.changeText(screen.getByLabelText('Ollama model name'), 'llama3');
  await fireEvent(screen.getByLabelText('Ollama server address'), 'blur');
  await fireEvent(screen.getByLabelText('Ollama model name'), 'blur');
  expect(await loadSettings()).toMatchObject({ provider: 'ollama', ollamaUrl: 'http://192.168.1.5:11434', ollamaModel: 'llama3' });
});

test('Appearance is saved and applied at once', async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(await screen.findByLabelText('Appearance Light'));
  expect((await loadSettings()).theme).toBe('light');
  await fireEvent.press(screen.getByLabelText('Appearance Dark'));
  expect((await loadSettings()).theme).toBe('dark');
  expect(screen.getByLabelText('Appearance Dark').props.accessibilityState.checked).toBe(true);
  setThemePreference('system');
});

test('a bad Ollama address is flagged and not saved', async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(await screen.findByLabelText('Ollama (your own computer)'));
  await fireEvent.changeText(screen.getByLabelText('Ollama server address'), 'not a url');
  await fireEvent(screen.getByLabelText('Ollama server address'), 'blur');
  expect(await screen.findByText(/It was not saved/)).toBeTruthy();
  expect((await loadSettings()).ollamaUrl).not.toBe('not a url');
});

test('Test connection says whether Ollama has the model', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ models: [{ name: 'llama3:latest' }] }) }) as unknown as typeof fetch;
  await render(<SettingsScreen />);
  await fireEvent.press(await screen.findByLabelText('Ollama (your own computer)'));
  await fireEvent.changeText(screen.getByLabelText('Ollama model name'), 'llama3');
  await fireEvent.press(screen.getByText('Test connection'));
  await waitFor(() => expect(screen.getByText(/Ollama is running and has “llama3”/)).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Ollama model name'), 'gemma');
  await fireEvent.press(screen.getByText('Test connection'));
  await waitFor(() => expect(screen.getByText(/no model called “gemma”/)).toBeTruthy());
});
