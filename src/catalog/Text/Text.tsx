import type { TextStyle } from 'react-native';
import { Text as RNText } from '@/ui/Text';
import { font, useTheme } from '@/ui/theme';
import type { TextProps } from './props';

const VARIANT: Record<TextProps['variant'], TextStyle> = {
  title: { fontSize: 30, fontFamily: font.display, lineHeight: 38 },
  heading: { fontSize: 19, fontFamily: font.display, lineHeight: 28 },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  muted: { fontSize: 15, lineHeight: 22 },
};

export function Text({ value, variant }: { value: string; variant: TextProps['variant'] }) {
  const t = useTheme();
  const quiet = variant === 'muted' || variant === 'caption';
  return (
    <RNText
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      style={[VARIANT[variant], { color: quiet ? t.muted : t.text }]}
    >
      {value}
    </RNText>
  );
}
