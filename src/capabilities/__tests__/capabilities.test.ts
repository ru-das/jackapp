import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator } from 'expo-image-manipulator';
import { pickImage } from '../image';
import { share } from '../share.web';
import { subscribeToast, toast } from '../toast';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const manipulate = ImageManipulator.manipulate as jest.Mock;

function setup(asset: { width: number; height: number }, base64: string | undefined = 'QUJD') {
  const saveAsync = jest.fn().mockResolvedValue({ base64 });
  const ctx = { resize: jest.fn(), renderAsync: jest.fn().mockResolvedValue({ saveAsync }) };
  manipulate.mockReturnValue(ctx);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a', ...asset }] } as never);
  return { ctx, saveAsync };
}

describe('pickImage', () => {
  test('downscales wide image to 1024 width, JPEG 0.8, data URI', async () => {
    const { ctx, saveAsync } = setup({ width: 4000, height: 2000 });
    expect(await pickImage({ source: 'any' })).toBe('data:image/jpeg;base64,QUJD');
    expect(ctx.resize).toHaveBeenCalledWith({ width: 1024 });
    expect(saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8, base64: true });
  });

  test('downscales tall image by height', async () => {
    const { ctx } = setup({ width: 1000, height: 3000 });
    await pickImage({ source: 'library' });
    expect(ctx.resize).toHaveBeenCalledWith({ height: 1024 });
  });

  test('does not upscale small images', async () => {
    const { ctx } = setup({ width: 800, height: 600 });
    await pickImage({ source: 'any' });
    expect(ctx.resize).not.toHaveBeenCalled();
  });

  test('camera source asks camera permission and launches camera', async () => {
    setup({ width: 10, height: 10 });
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'u', width: 10, height: 10 }] } as never);
    await pickImage({ source: 'camera' });
    expect(picker.launchCameraAsync).toHaveBeenCalled();
  });

  test('cancel returns null', async () => {
    setup({ width: 1, height: 1 });
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickImage({ source: 'any' })).toBeNull();
  });

  test('permission denied throws a friendly error', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    await expect(pickImage({ source: 'camera' })).rejects.toThrow('Camera access is off.');
  });
});

describe('share (web)', () => {
  const nav = navigator as unknown as Record<string, unknown>;
  afterEach(() => { delete nav.share; delete nav.clipboard; });

  test('uses Web Share when available', async () => {
    nav.share = jest.fn().mockResolvedValue(undefined);
    await share('hi');
    expect(nav.share).toHaveBeenCalledWith({ text: 'hi' });
  });

  test('user cancel is not an error; other errors propagate', async () => {
    nav.share = jest.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));
    await expect(share('hi')).resolves.toBeUndefined();
    nav.share = jest.fn().mockRejectedValueOnce(new Error('boom'));
    await expect(share('hi')).rejects.toThrow('boom');
  });

  test('falls back to clipboard with a toast', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    nav.clipboard = { writeText };
    const seen: string[] = [];
    const off = subscribeToast((m) => seen.push(m));
    await share('hi');
    off();
    expect(writeText).toHaveBeenCalledWith('hi');
    expect(seen).toEqual(['Copied to clipboard']);
  });
});

test('toast notifies until unsubscribed', () => {
  const fn = jest.fn();
  const off = subscribeToast(fn);
  toast('a');
  off();
  toast('b');
  expect(fn.mock.calls).toEqual([['a']]);
});
