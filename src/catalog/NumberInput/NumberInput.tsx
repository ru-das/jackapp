import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';
import type { NumberInputProps } from './props';

interface Props extends Pick<NumberInputProps, 'label' | 'min' | 'max' | 'step' | 'mode'> {
  value: number; onChange(v: number): void;
}

export function NumberInput({ label, min, max, step, mode, value, onChange }: Props) {
  const t = useTheme();
  const set = (n: number) => {
    if (!Number.isFinite(n)) return;
    onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
  };
  const stepper = (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => set(value - step)}
        style={[styles.round, { backgroundColor: t.accentSoft }]}>
        <Text style={[styles.sign, { color: t.accent }]}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${label}: ${value}`} style={[styles.value, { color: t.text }]}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => set(value + step)}
        style={[styles.round, { backgroundColor: t.accentSoft }]}>
        <Text style={[styles.sign, { color: t.accent }]}>+</Text>
      </Pressable>
    </View>
  );
  // shortcut: slider is a stepper over a progress bar (no native slider in core RN), swap for a real slider if one ships with Expo.
  const slider = (
    <View style={{ gap: space.sm }}>
      {stepper}
      <View style={[styles.track, { backgroundColor: t.border }]}>
        <View style={[styles.fill, { backgroundColor: t.accent, width: `${Math.round(((value - (min ?? 0)) / ((max ?? 1) - (min ?? 0) || 1)) * 100)}%` }]} />
      </View>
    </View>
  );
  const field = (
    <TextInput
      accessibilityLabel={label} keyboardType="numeric" value={String(value)}
      onChangeText={(s) => { if (s.trim() !== '' && !Number.isNaN(Number(s))) set(Number(s)); }}
      style={[styles.field, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
    />
  );
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      {mode === 'field' ? field : mode === 'slider' ? slider : stepper}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  round: { width: MIN_TARGET + 4, height: MIN_TARGET + 4, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: 24, fontWeight: '600' },
  value: { minWidth: 48, textAlign: 'center', fontSize: 22, fontWeight: '600' },
  field: { minHeight: MIN_TARGET, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, fontSize: 16 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
