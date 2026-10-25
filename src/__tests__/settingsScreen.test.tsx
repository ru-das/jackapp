import { fireEvent, render, screen } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { loadSettings } from '@/storage/settings';

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
  expect(await loadSettings()).toMatchObject({ provider: 'ollama', ollamaUrl: 'http://192.168.1.5:11434', ollamaModel: 'llama3' });
});
