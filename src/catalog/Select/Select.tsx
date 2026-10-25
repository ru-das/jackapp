import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';

interface Props { label: string; value: string; options: string[]; onChange(v: string): void }

export function Select({ label, value, options, onChange }: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o)}
              style={(st) => [styles.chip, { backgroundColor: on ? t.accent : t.bg, borderColor: on ? t.accent : t.outline }, pressed(st)]}
            >
              <Text style={{ color: on ? t.accentText : t.text, fontSize: 15, fontWeight: on ? '600' : '400' }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontSize: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: space.md, justifyContent: 'center',
    alignItems: 'center', borderRadius: radius.pill, borderWidth: 1,
  },
});
