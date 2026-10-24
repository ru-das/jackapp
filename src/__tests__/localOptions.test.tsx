import { fireEvent, render, screen } from '@testing-library/react-native';
import { localModel } from '@/ai/providers/litert';
import { LocalOptions } from '@/ui/LocalOptions';

// The native module is absent under jest, so make the provider report itself available.
jest.mock('@/ai/providers/litert', () => ({
  localModel: { available: true, tuning: { backend: 'gpu', speculative: false, constrained: true } },
}));

test('each switch changes the shared on-device tuning', async () => {
  await render(<LocalOptions />);
  await fireEvent(screen.getByLabelText('GPU'), 'valueChange', false);
  await fireEvent(screen.getByLabelText('Speculative decoding'), 'valueChange', true);
  await fireEvent(screen.getByLabelText('Constrained JSON'), 'valueChange', false);
  expect(localModel.tuning).toEqual({ backend: 'cpu', speculative: true, constrained: false });
  await fireEvent(screen.getByLabelText('GPU'), 'valueChange', true);
  expect(localModel.tuning.backend).toBe('gpu');
});

test('hidden when the on-device model is not part of this build', async () => {
  localModel.available = false;
  await render(<LocalOptions />);
  expect(screen.queryByLabelText('GPU')).toBeNull();
});
