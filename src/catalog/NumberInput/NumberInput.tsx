import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';
import type { NumberInputProps } from './props';

interface Props extends Pick<NumberInputProps, 'label' | 'min' | 'max' | 'step' | 'mode'> {
  value: number; onChange(v: number): void;
}

/** Parses what the user typed; the reason is short enough to show under the field. */
export function checkNumber(text: string, min?: number, max?: number): { value: number } | { error: string } {
  const s = text.trim();
  if (s === '') return { error: 'Enter a number' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { error: 'Numbers only, like 12.5' };
  if (min !== undefined && n < min) return { error: `At least ${min}` };
  if (max !== undefined && n > max) return { error: `At most ${max}` };
  return { value: n };
}

// Keeps the typed text while editing so "", "-" and "1." survive; only a valid number is committed.
function NumberField({ label, min, max, value, onChange }: Pick<Props, 'label' | 'min' | 'max' | 'value' | 'onChange'>) {
  const t = useTheme();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState('');
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) { committed.current = value; setText(String(value)); setError(''); }
  }, [value]);
  const type = (s: string) => {
    setText(s);
    const r = checkNumber(s, min, max);
    if ('value' in r) { setError(''); committed.current = r.value; onChange(r.value); }
    else setError(/^[-+.]?$/.test(s.trim()) ? '' : r.error); // a lone "-" or "." is mid-typing, not wrong
  };
  const leave = () => {
    const r = checkNumber(text, min, max);
    if ('value' in r) return;
    setText(String(value));
    setError(`${r.error}. Kept ${value}.`);
  };
  return (
    <View style={{ gap: 4 }}>
      <TextInput
        accessibilityLabel={label} keyboardType={min !== undefined && min >= 0 ? 'decimal-pad' : 'default'} value={text} onChangeText={type} onBlur={leave}
        style={[styles.field, { color: t.text, backgroundColor: t.bg, borderColor: error ? t.danger : t.border }]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={{ color: t.danger, fontSize: 14 }}>{error}</Text> : null}
    </View>
  );
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
        <Text maxFontSizeMultiplier={1.5} style={[styles.sign, { color: t.accent }]}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${label}: ${value}`} style={[styles.value, { color: t.text }]}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => set(value + step)}
        style={[styles.round, { backgroundColor: t.accentSoft }]}>
        <Text maxFontSizeMultiplier={1.5} style={[styles.sign, { color: t.accent }]}>+</Text>
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
  const field = <NumberField label={label} min={min} max={max} value={value} onChange={onChange} />;
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
