import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

interface Props { label: string; value: string | null; onChange(value: string | null): void; today?: () => string }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export function validDay(text: string): boolean {
  const m = ISO.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

// shortcut: typed YYYY-MM-DD plus a Today button, so no native picker dependency; add @react-native-community/datetimepicker when a rebuild is acceptable.
export function DateInput({ label, value, onChange, today = () => new Date().toISOString().slice(0, 10) }: Props) {
  const t = useTheme();
  // What the user is typing, only while it differs from the stored day; the stored day is shown the rest of the time.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value?.slice(0, 10) ?? '';
  const bad = text !== '' && !validDay(text);
  const edit = (next: string) => {
    setDraft(next);
    if (next === '') onChange(null);
    else if (validDay(next)) onChange(next);
  };
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <View style={styles.row}>
        <RNTextInput
          accessibilityLabel={label} value={text} onChangeText={edit} onBlur={() => setDraft(null)} placeholder="YYYY-MM-DD" placeholderTextColor={t.muted}
          keyboardType="numbers-and-punctuation" maxLength={10}
          style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: bad ? t.danger : t.border }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={`Today: ${label}`} onPress={() => { setDraft(null); onChange(today()); }}
          style={[styles.today, { backgroundColor: t.accentSoft }]}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>Today</Text>
        </Pressable>
      </View>
      {bad ? <Text accessibilityLiveRegion="polite" style={{ color: t.danger, fontSize: 13 }}>Use the form YYYY-MM-DD, like 2026-10-25.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: MIN_TARGET, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, fontSize: 16 },
  today: { minHeight: MIN_TARGET, borderRadius: radius.control, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
