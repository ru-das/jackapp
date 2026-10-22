import { StyleSheet, Text, View } from 'react-native';
import type { Unsupported } from '@/ai/generator/outputSchemas';
import { ActionButton } from './ActionButton';
import { radius, space, useTheme } from './theme';

type Props = { unsupported: Unsupported; onBuildSuggestion(): void };

export function UnsupportedCard({ unsupported, onBuildSuggestion }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>I can&apos;t build that one yet</Text>
      <Text style={{ color: t.text, fontSize: 16 }}>{unsupported.reason}</Text>
      <Text style={{ color: t.muted, fontSize: 15 }}>Missing: {unsupported.missing.join(', ')}</Text>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>What I can do instead</Text>
      <Text style={{ color: t.text, fontSize: 16 }}>{unsupported.suggestion}</Text>
      <ActionButton label="Build the suggestion" onPress={onBuildSuggestion} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
});
