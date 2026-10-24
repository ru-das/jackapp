import { fireEvent, render, screen } from '@testing-library/react-native';
import EvalScreen from '@/app/dev/eval';
import { mockProvider } from '@/ai/providers/mock';
import { saveFile, share } from '@/capabilities';

let mockSlow: ((req: never) => Promise<string>) | null = null;
jest.mock('@/ai/provider', () => ({
  getActiveProvider: async () => {
    const real = jest.requireActual('@/ai/providers/mock').mockProvider;
    return { provider: mockSlow ? { ...real, generate: mockSlow } : real, model: 'test-model' };
  },
}));
jest.mock('@/capabilities', () => ({ share: jest.fn(), saveFile: jest.fn(async () => true), toast: jest.fn() }));

beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); mockSlow = null; });

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
  // The saved JSON carries the run log: every call's start and finish, then the row result.
  expect(json.log.some((l: string) => /e01 → PLAN: \d+ system chars/.test(l))).toBe(true);
  expect(json.log.some((l: string) => /e01 → FILL:/.test(l))).toBe(true);
  expect(json.log.some((l: string) => /e01 ✓ done after/.test(l))).toBe(true);
  // Full model output is saved for debugging but kept off the screen.
  expect(json.log.some((l: string) => /e01 ⎘ output: app name=/.test(l))).toBe(true);
  expect(screen.queryByText(/⎘ output/)).toBeNull();
  expect(screen.getByLabelText('Run log')).toBeTruthy();
  expect(screen.getAllByText(/→ PLAN/).length).toBeGreaterThan(0);

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

test('while a call streams, the status line shows the stage, characters and speed', async () => {
  const real = mockProvider.generate.bind(mockProvider);
  mockSlow = async (req: Parameters<typeof real>[0]) => {
    req.onLog?.('GPU: model load 0 ms');
    req.onPartial?.(80);
    await new Promise((resolve) => setTimeout(resolve, 1300));
    return real(req);
  };
  await render(<EvalScreen />);
  await fireEvent.press(screen.getByLabelText('Prompt e01'));
  await fireEvent(screen.getByLabelText('Skip plan stage'), 'valueChange', true);
  await fireEvent.press(screen.getByText('Run'));
  expect(await screen.findByText(/e01 \(1\/1\) · FILL · writing 80 chars \(~20 tokens/, {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.getByText(/← first token after/)).toBeTruthy();
  expect(screen.getByText(/GPU: model load 0 ms/)).toBeTruthy();
  await screen.findByText('Results', {}, { timeout: 3000 });
});
