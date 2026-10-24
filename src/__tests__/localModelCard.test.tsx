import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalModelCard } from '@/ui/LocalModelCard';
import { localModel } from '@/ai/providers/litert';

jest.mock('@/ai/providers/litert', () => ({
  localModel: { available: true, isDownloaded: jest.fn(), download: jest.fn(), remove: jest.fn(async () => {}) },
}));
jest.mock('@/capabilities', () => ({ confirm: jest.fn(async () => true) }));

const model = localModel as jest.Mocked<typeof localModel>;

test('offers the download, shows progress, then shows Ready with a delete button', async () => {
  model.isDownloaded.mockResolvedValue(false);
  model.download.mockImplementation(async (onProgress) => { onProgress({ loaded: 1_294_073_856, total: 2_588_147_712 }); });
  await render(<LocalModelCard style={{}} />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  expect(await screen.findByText('Ready on this phone.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Delete model'));
  expect(model.remove).toHaveBeenCalled();
  expect(await screen.findByLabelText('Download (2.6 GB)')).toBeTruthy();
});

test('a failed download shows the friendly error and keeps the button', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  model.isDownloaded.mockResolvedValue(false);
  model.download.mockRejectedValue(new Error('The download did not finish. Check your connection and try again.'));
  await render(<LocalModelCard style={{}} />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  expect(await screen.findByText(/did not finish/)).toBeTruthy();
  expect(screen.getByLabelText('Download (2.6 GB)')).toBeTruthy();
});
