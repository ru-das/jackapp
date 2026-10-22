import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

interface Props {
  label: string; value: string; placeholder?: string; multiline: boolean;
  onChange(value: string): void; onSubmit?(): void;
}

export function TextInput({ label, value, placeholder, multiline, onChange, onSubmit }: Props) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <RNTextInput
        accessibilityLabel={label} value={value} placeholder={placeholder} placeholderTextColor={t.muted}
        multiline={multiline} onChangeText={onChange}
        onSubmitEditing={multiline ? undefined : onSubmit} returnKeyType={onSubmit ? 'done' : undefined}
        style={[styles.input, multiline && styles.multi, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    minHeight: MIN_TARGET, borderRadius: radius.control, borderWidth: 1,
    paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16,
  },
  multi: { minHeight: 96, textAlignVertical: 'top' },
});
