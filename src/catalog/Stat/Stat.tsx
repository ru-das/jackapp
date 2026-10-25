import { StyleSheet, Text, View } from 'react-native';
import { radius, space, useTheme } from '@/ui/theme';

export function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View
      accessible accessibilityLabel={`${label}: ${value}`}
      style={[styles.box, { backgroundColor: t.accentSoft, borderRadius: radius.control }]}
    >
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <Text maxFontSizeMultiplier={1.5} style={[styles.value, { color: t.accent }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, gap: 2 },
  label: { fontSize: 14 },
  value: { fontSize: 34, fontWeight: '700' },
});
