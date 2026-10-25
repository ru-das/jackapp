import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.8;

export type ImageSource = 'camera' | 'library' | 'any';

/** A failure whose message is safe to show as it is. */
export class PhotoError extends Error {}

/** Returns a downscaled JPEG data URI, or null if the user cancelled. */
export async function pickImage({ source }: { source: ImageSource }): Promise<string | null> {
  const camera = source === 'camera';
  const perm = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PhotoError(camera ? 'Camera access is off. Turn it on in system settings.' : 'Photo access is off. Turn it on in system settings.');

  // shortcut: 'any' opens the library; ImageInput can offer a camera button too, revisit if a chooser is needed
  const result = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets[0]) return null;

  const { uri, width, height } = result.assets[0];
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const saved = await (await ctx.renderAsync()).saveAsync({
    format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true,
  });
  if (!saved.base64) throw new PhotoError('Couldn’t read that photo. Try another.');
  return `data:image/jpeg;base64,${saved.base64}`;
}
