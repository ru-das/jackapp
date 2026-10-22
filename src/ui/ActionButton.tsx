import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from './theme';

type Props = { label: string; onPress(): void; kind?: 'primary' | 'quiet'; disabled?: boolean };

export function ActionButton({ label, onPress, kind = 'primary', disabled }: Props) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={[styles.btn, { backgroundColor: primary ? t.accent : t.accentSoft, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={[styles.text, { color: primary ? t.accentText : t.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: MIN_TARGET, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, paddingVertical: 10 },
  text: { fontSize: 16, fontWeight: '600' },
});
