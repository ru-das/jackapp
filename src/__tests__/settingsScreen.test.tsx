import { fireEvent, render, screen } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { OPENROUTER_MODELS } from '@/ai/models';
import { loadSettings } from '@/storage/settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('saves the OpenRouter key and lists the free model per step', async () => {
  await render(<SettingsScreen />);
  await fireEvent.changeText(await screen.findByLabelText('OpenRouter API key'), 'sk-or-abc');
  expect((await loadSettings()).openrouterKey).toBe('sk-or-abc');
  expect(screen.queryByText(`Building: ${OPENROUTER_MODELS.fill}`)).toBeNull(); // model ids sit behind details
  await fireEvent.press(screen.getByText(/Model details/));
  expect(screen.getByText(`Building: ${OPENROUTER_MODELS.fill}`)).toBeTruthy();
});

test('switching to Ollama saves the address and model', async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(await screen.findByLabelText('Ollama (your own computer)'));
  await fireEvent.changeText(screen.getByLabelText('Ollama server address'), 'http://192.168.1.5:11434');
  await fireEvent.changeText(screen.getByLabelText('Ollama model name'), 'llama3');
  expect(await loadSettings()).toMatchObject({ provider: 'ollama', ollamaUrl: 'http://192.168.1.5:11434', ollamaModel: 'llama3' });
});
