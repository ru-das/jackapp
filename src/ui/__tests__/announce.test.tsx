import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { toast } from '@/capabilities/toast';
import { NumberInput } from '@/catalog/NumberInput/NumberInput';
import { GenerationStages } from '@/ui/GenerationStages';
import { Toaster } from '@/ui/Toaster';

let announce: jest.SpyInstance;
beforeEach(() => { announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}); });
afterEach(() => announce.mockRestore());

test('a toast is spoken once, not only shown', async () => {
  await render(<Toaster />);
  await act(async () => { toast('Couldn’t export.'); });
  expect(screen.getByText('Couldn’t export.')).toBeTruthy();
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('Couldn’t export.');
});

test('a field error is spoken when it appears', async () => {
  await render(<NumberInput label="Tip" min={0} max={100} step={1} mode="field" value={10} onChange={() => {}} />);
  expect(announce).not.toHaveBeenCalled();
  await act(async () => { screen.getByLabelText('Tip').props.onChangeText('500'); });
  expect(announce).toHaveBeenCalledWith('At most 100');
});

test('the build progress live region does not carry the ticking clock', async () => {
  await render(<GenerationStages progress={{ stage: 'building', attempt: 0 }} />);
  const region = screen.getByLabelText('Step: Building');
  expect(region.props.accessibilityLabel).not.toMatch(/second/);
  expect(screen.getByText(/ s · Usually under half a minute/)).toBeTruthy();
});
