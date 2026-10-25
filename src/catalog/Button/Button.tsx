import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Tap } from '@/ui/Tap';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';
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
    <Tap
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy, busy }}
      disabled={busy} onPress={onPress}
      style={(st) => [styles.btn, { backgroundColor: look.bg, borderColor: look.border, opacity: busy ? 0.6 : 1 }, pressed(st)]}
    >
      {busy ? <ActivityIndicator color={look.fg} /> : null}
      <Text style={[styles.text, { color: look.fg }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: MIN_TARGET + 4, borderRadius: radius.control, borderWidth: 1.5, paddingHorizontal: space.lg,
    paddingVertical: 10, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center',
  },
  text: { fontSize: 16, fontWeight: '600' },
});
