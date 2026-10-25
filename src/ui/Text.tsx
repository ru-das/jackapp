import type { ComponentProps } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextStyle } from 'react-native';
import { font } from './theme';

// Android ignores `fontWeight` on a custom family, so the weight picks the Figtree file instead. A style that names its own family keeps it.
export function withFont(style: ComponentProps<typeof RNText>['style']): TextStyle {
  const { fontWeight, fontFamily, ...rest } = StyleSheet.flatten(style) ?? {};
  const w = fontWeight === 'bold' ? 700 : Number(fontWeight ?? 400);
  return { ...rest, fontFamily: fontFamily ?? (w >= 700 ? font.bold : w >= 600 ? font.semibold : w >= 500 ? font.medium : font.body) };
}

export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  return <RNText {...props} style={withFont(style)} />;
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={withFont(style)} />;
}
