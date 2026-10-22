import { Share } from 'react-native';

export async function share(text: string): Promise<void> {
  await Share.share({ message: text });
}
