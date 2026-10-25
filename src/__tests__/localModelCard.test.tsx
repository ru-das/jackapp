import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalModelCard } from '@/ui/LocalModelCard';
import { localModel } from '@/ai/providers/litert';

jest.mock('@/ai/providers/litert', () => ({
  localModel: { available: true, isDownloaded: jest.fn(), isLoaded: jest.fn(() => false), partialBytes: jest.fn(async () => 0), warmUp: jest.fn(async () => {}), download: jest.fn(), remove: jest.fn(async () => {}) },
}));
jest.mock('@/capabilities', () => ({ confirm: jest.fn(async () => true) }));

const model = localModel as jest.Mocked<typeof localModel>;

test('offers the download, shows progress, then shows Downloaded with a delete button', async () => {
  model.isDownloaded.mockResolvedValue(false);
  model.download.mockImplementation(async (onProgress) => { onProgress({ loaded: 1_294_073_856, total: 2_588_147_712 }); });
  await render(<LocalModelCard />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  expect(await screen.findByText(/^Downloaded\. It loads into memory/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Delete model'));
  expect(model.remove).toHaveBeenCalled();
  expect(await screen.findByLabelText('Download (2.6 GB)')).toBeTruthy();
});

test('the progress bar tells a screen reader how far the download is', async () => {
  model.isDownloaded.mockResolvedValue(false);
  model.download.mockImplementation((onProgress) => { onProgress({ loaded: 1_294_073_856, total: 2_588_147_712 }); return new Promise(() => {}); });
  await render(<LocalModelCard />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  const bar = await screen.findByRole('progressbar');
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 50, text: '1.3 of 2.6 GB' });
  expect(screen.getByLabelText('Cancel download')).toBeTruthy(); // the button is not swallowed by the bar
});

test('a failed download shows the friendly error and keeps the button', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  model.isDownloaded.mockResolvedValue(false);
  model.download.mockRejectedValue(new Error('The download did not finish. Check your connection and try again.'));
  await render(<LocalModelCard />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  expect(await screen.findByText(/did not finish/)).toBeTruthy();
  expect(screen.getByLabelText('Download (2.6 GB)')).toBeTruthy();
});

test('an interrupted download shows Paused with Resume and Delete', async () => {
  model.isDownloaded.mockResolvedValue(false);
  model.partialBytes.mockResolvedValue(1_200_000_000);
  model.download.mockResolvedValue(undefined);
  await render(<LocalModelCard />);
  expect(await screen.findByText('Paused at 1.2 of 2.6 GB.')).toBeTruthy();
  expect(screen.getByLabelText('Delete model')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Resume download'));
  expect(model.download).toHaveBeenCalledWith(expect.any(Function), expect.any(AbortSignal));
  model.partialBytes.mockResolvedValue(0);
});

test('cancel aborts the download and returns to Paused without an error', async () => {
  model.isDownloaded.mockResolvedValue(false);
  model.partialBytes.mockResolvedValue(0);
  model.download.mockImplementation((_p, signal) => new Promise((_res, rej) => {
    signal?.addEventListener('abort', () => { model.partialBytes.mockResolvedValue(500_000_000); rej(new Error('aborted')); });
  }));
  await render(<LocalModelCard />);
  await fireEvent.press(await screen.findByLabelText('Download (2.6 GB)'));
  await fireEvent.press(await screen.findByLabelText('Cancel download'));
  expect(await screen.findByText('Paused at 0.5 of 2.6 GB.')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  model.partialBytes.mockResolvedValue(0);
});

test('downloaded but not loaded offers Load now, then reads Downloaded and loaded', async () => {
  model.isDownloaded.mockResolvedValue(true);
  model.isLoaded.mockReturnValue(false);
  model.warmUp.mockImplementation(async () => { model.isLoaded.mockReturnValue(true); });
  await render(<LocalModelCard />);
  await fireEvent.press(await screen.findByLabelText('Load now'));
  expect(await screen.findByText('Downloaded and loaded. Ready offline.')).toBeTruthy();
  model.isLoaded.mockReturnValue(false);
});
