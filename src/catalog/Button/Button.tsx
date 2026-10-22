import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TARGET, radius, useTheme } from '@/ui/theme';
import type { ButtonProps } from './props';

interface Props { label: string; variant: ButtonProps['variant']; busy: boolean; onPress(): void }

export function Button({ label, variant, busy, onPress }: Props) {
  const t = useTheme();
  const look = {
    primary: { bg: t.accent, fg: t.accentText, border: t.accent },
    secondary: { bg: 'transparent', fg: t.accent, border: t.accent },
    danger: { bg: t.dangerSoft, fg: t.danger, border: t.dangerSoft },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy, busy }}
      disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: look.bg, borderColor: look.border, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={look.fg} /> : null}
      <Text style={[styles.text, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: MIN_TARGET + 4, borderRadius: radius.control, borderWidth: 1.5, paddingHorizontal: 20,
    paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '600' },
});
