import { StyleSheet, Text } from 'react-native';
import type { Unsupported } from '@/ai/generator/outputSchemas';
import { ActionButton } from './ActionButton';
import { Card } from './Card';
import { type, useTheme } from './theme';

type Props = { unsupported: Unsupported; onBuildSuggestion(): void };

export function UnsupportedCard({ unsupported, onBuildSuggestion }: Props) {
  const t = useTheme();
  return (
    <Card>
      <Text accessibilityRole="header" accessibilityLabel="That one’s out of my reach, for now" style={[styles.h, { color: t.text }]}>🦥 That one’s out of my reach (for now)</Text>
      <Text style={{ color: t.text, fontSize: type.body }}>{unsupported.reason}</Text>
      <Text style={{ color: t.muted, fontSize: type.hint }}>I’d need: {unsupported.missing.join(', ')}</Text>
      <Text style={{ color: t.text, fontSize: type.body, fontWeight: '600' }}>But I could do this</Text>
      <Text style={{ color: t.text, fontSize: type.body }}>{unsupported.suggestion}</Text>
      <ActionButton label="Build the suggestion" onPress={onBuildSuggestion} />
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { fontSize: type.h, fontWeight: '600' },
});
