import { StyleSheet } from 'react-native';
import { Text } from '@/ui/Text';
import { Icon, type IconName } from '@/ui/Icon';
import { Tap } from '@/ui/Tap';
import { MIN_TARGET, pressed, radius, space, type, useTheme } from './theme';

type Props = { label: string; onPress(): void; kind?: 'primary' | 'quiet' | 'danger'; disabled?: boolean; accessibilityLabel?: string; icon?: IconName };

export function ActionButton({ label, onPress, kind = 'primary', disabled, accessibilityLabel, icon }: Props) {
  const t = useTheme();
  const look = { primary: [t.accent, t.accentText], quiet: [t.accentSoft, t.text], danger: [t.dangerSoft, t.danger] }[kind];
  return (
    <Tap
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={(s) => [styles.btn, { backgroundColor: look[0], opacity: disabled ? 0.5 : 1 }, pressed(s)]}
    >
      {icon ? <Icon name={icon} size={20} color={look[1]} /> : null}
      <Text style={[styles.text, { color: look[1] }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', gap: space.sm, minHeight: MIN_TARGET, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, paddingVertical: 10 },
  text: { fontSize: type.body, fontWeight: '600' },
});
