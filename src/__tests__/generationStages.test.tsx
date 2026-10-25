import { render, screen } from '@testing-library/react-native';
import { GenerationStages } from '@/ui/GenerationStages';

test('no notice for a ready-made app type', async () => {
  await render(<GenerationStages progress={{ stage: 'building', attempt: 0 }} />);
  expect(screen.queryByText(/ready-made/)).toBeNull();
});

test.each([
  ['cloud', /the cloud model is building it/],
  ['device', /That can take a few minutes and may not work/],
] as const)('free-form on %s is announced', async (freeForm, text) => {
  await render(<GenerationStages progress={{ stage: 'building', attempt: 0, freeForm }} />);
  expect(screen.getByText(text)).toBeTruthy();
});

test('shows the real stages and a measured time, never Planning or "a minute or two"', async () => {
  await render(<GenerationStages progress={{ stage: 'building', attempt: 0 }} />);
  expect(screen.queryByText(/Planning/)).toBeNull();
  expect(screen.getByText(/Usually under half a minute/)).toBeTruthy();
  expect(screen.queryByText(/minute or two/)).toBeNull();
});
