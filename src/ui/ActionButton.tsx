import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TARGET, pressed, radius, space, type, useTheme } from './theme';

type Props = { label: string; onPress(): void; kind?: 'primary' | 'quiet' | 'danger'; disabled?: boolean; accessibilityLabel?: string };

export function ActionButton({ label, onPress, kind = 'primary', disabled, accessibilityLabel }: Props) {
  const t = useTheme();
  const look = { primary: [t.accent, t.accentText], quiet: [t.accentSoft, t.text], danger: [t.dangerSoft, t.danger] }[kind];
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={(s) => [styles.btn, { backgroundColor: look[0], opacity: disabled ? 0.5 : 1 }, pressed(s)]}
    >
      <Text style={[styles.text, { color: look[1] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: MIN_TARGET, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, paddingVertical: 10 },
  text: { fontSize: type.body, fontWeight: '600' },
});
