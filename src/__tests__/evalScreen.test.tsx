import { fireEvent, render, screen } from '@testing-library/react-native';
import EvalScreen from '@/app/dev/eval';
import { mockProvider } from '@/ai/providers/mock';
import { saveFile, share } from '@/capabilities';

jest.mock('@/ai/provider', () => ({ getProvider: () => jest.requireActual('@/ai/providers/mock').mockProvider }));
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
  expect(json).toMatchObject({ model: 'E2B', options: { noPlan: false, only: 'e01' } });
  expect(json.rows).toHaveLength(1);

  await fireEvent.press(screen.getByText('Save file'));
  expect((saveFile as jest.Mock).mock.calls[0][0]).toMatch(/^eval-.*-E2B-plan\.json$/);
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

test('model not downloaded: points to Settings', async () => {
  jest.spyOn(mockProvider, 'status').mockReturnValue('unloaded');
  jest.spyOn(mockProvider, 'isDownloaded').mockResolvedValue(false);
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByText('Run'));
  expect(await screen.findByText(/in Settings first/)).toBeTruthy();
});
