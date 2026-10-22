import { Image as RNImage, StyleSheet } from 'react-native';
import { radius, useTheme } from '@/ui/theme';
import type { ImageProps } from './props';

const RATIO = { square: 1, wide: 16 / 9, tall: 3 / 4 } as const;

export function Image({ src, aspect, alt }: { src: string | null; aspect: ImageProps['aspect']; alt: string }) {
  const t = useTheme();
  if (!src) return null;
  return (
    <RNImage
      source={{ uri: src }} accessibilityLabel={alt} accessible={alt !== ''}
      style={[styles.img, { aspectRatio: RATIO[aspect], backgroundColor: t.border }]}
    />
  );
}

const styles = StyleSheet.create({ img: { width: '100%', borderRadius: radius.control } });
