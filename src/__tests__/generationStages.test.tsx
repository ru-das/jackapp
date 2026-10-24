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
