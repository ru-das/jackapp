import { StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import type { Unsupported } from '@/ai/generator/outputSchemas';
import { ActionButton } from './ActionButton';
import { AppIcon } from './AppIcon';
import { Card } from './Card';
import { font, space, type, useTheme } from './theme';

type Props = { unsupported: Unsupported; onBuildSuggestion(): void };

export function UnsupportedCard({ unsupported, onBuildSuggestion }: Props) {
  const t = useTheme();
  return (
    <Card>
      <View style={styles.head}>
        <AppIcon size={32} />
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>That one’s out of my reach (for now)</Text>
      </View>
      <Text style={{ color: t.text, fontSize: type.body }}>{unsupported.reason}</Text>
      <Text style={{ color: t.muted, fontSize: type.hint }}>I’d need: {unsupported.missing.join(', ')}</Text>
      <Text style={{ color: t.text, fontSize: type.body, fontWeight: '600' }}>But I could do this</Text>
      <Text style={{ color: t.text, fontSize: type.body }}>{unsupported.suggestion}</Text>
      <ActionButton icon="bulb-outline" label="Build the suggestion" onPress={onBuildSuggestion} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  h: { flex: 1, fontSize: type.h, fontFamily: font.display },
});
