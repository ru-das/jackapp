import { fireEvent, render, screen } from '@testing-library/react-native';
import EvalScreen from '@/app/dev/eval';
import { mockProvider } from '@/ai/providers/mock';
import { saveFile, share } from '@/capabilities';

jest.mock('@/ai/provider', () => ({
  getActiveProvider: async () => ({ provider: jest.requireActual('@/ai/providers/mock').mockProvider, model: 'test-model' }),
}));
jest.mock('@/capabilities', () => ({ share: jest.fn(), saveFile: jest.fn(async () => true), toast: jest.fn() }));

afterEach(() => jest.restoreAllMocks());

test('runs one prompt, shows row + metrics, shares and saves the results JSON', async () => {
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByLabelText('Prompt e01'));
  await fireEvent.press(screen.getByText('Run'));
  expect(await screen.findByText('Results')).toBeTruthy();
  expect(screen.getByText(/1 \/ 1 done/)).toBeTruthy();
  expect(screen.getByText(/✓ e01 · done/)).toBeTruthy();

  await fireEvent.press(screen.getByText('Share'));
  const json = JSON.parse((share as jest.Mock).mock.calls[0][0]);
  expect(json).toMatchObject({ model: 'test-model', options: { noPlan: false, only: 'e01' } });
  expect(json.rows).toHaveLength(1);

  await fireEvent.press(screen.getByText('Save file'));
  expect((saveFile as jest.Mock).mock.calls[0][0]).toMatch(/^eval-.*-test-model-plan\.json$/);
});

test('no-plan switch is passed to the run', async () => {
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByLabelText('Prompt e01'));
  await fireEvent(screen.getByLabelText('Skip plan stage'), 'valueChange', true);
  await fireEvent.press(screen.getByText('Run'));
  await screen.findByText('Results');
  await fireEvent.press(screen.getByText('Share'));
  expect(JSON.parse((share as jest.Mock).mock.calls.at(-1)[0]).options.noPlan).toBe(true);
});

test('AI not set up: points to Settings', async () => {
  jest.spyOn(mockProvider, 'isConfigured').mockResolvedValue(false);
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByText('Run'));
  expect(await screen.findByText(/in Settings first/)).toBeTruthy();
});

test('Quick chip runs the 6-prompt subset', async () => {
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByLabelText('Prompt Quick 6'));
  await fireEvent.press(screen.getByText('Run'));
  expect(await screen.findByText(/6 \/ 6 done/)).toBeTruthy();
});
