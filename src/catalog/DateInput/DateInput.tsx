import { useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Icon } from '@/ui/Icon';
import { useAnnounce } from '@/ui/announce';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';

interface Props { label: string; value: string | null; onChange(value: string | null): void; today?: () => string }

const BAD_DAY = 'Use the form YYYY-MM-DD, like 2026-10-25.';
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Keeps only digits and puts the hyphens in, so a digits-only keypad is enough (Android has no "numbers and punctuation" keyboard) and 20261025 reads 2026-10-25. */
export function formatDay(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}
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
  useAnnounce(bad ? BAD_DAY : null);
  const edit = (typed: string) => {
    const next = formatDay(typed);
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
          keyboardType="number-pad" maxLength={10}
          style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: bad ? t.danger : t.outline }]}
        />
        <Tap accessibilityRole="button" accessibilityLabel={`Today: ${label}`} onPress={() => { setDraft(null); onChange(today()); }}
          style={(st) => [styles.today, { backgroundColor: t.accentSoft }, pressed(st)]}>
          <Icon name="today-outline" size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: '600' }}>Today</Text>
        </Tap>
      </View>
      {bad ? <Text style={{ color: t.danger, fontSize: 13 }}>{BAD_DAY}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: MIN_TARGET, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md, fontSize: 16 },
  today: { flexDirection: 'row', gap: 6, minHeight: MIN_TARGET, borderRadius: radius.control, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' },
});
