import { StyleSheet, Switch, Text, View } from 'react-native';
import { MIN_TARGET, useTheme } from '@/ui/theme';

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label} value={value} onValueChange={onChange}
        trackColor={{ true: t.accent, false: t.border }} thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 16 },
});
