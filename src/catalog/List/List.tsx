import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

export interface ListRow { key: string; title: string; subtitle?: string; trailing?: string; checked?: boolean }
interface Props {
  rows: ListRow[]; emptyText: string;
  onToggle?(i: number): void; onDelete?(i: number): void; onPress?(i: number): void;
}

export function List({ rows, emptyText, onToggle, onDelete, onPress }: Props) {
  const t = useTheme();
  if (rows.length === 0) return <Text style={[styles.empty, { color: t.muted }]}>{emptyText}</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={r.key} style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          {onToggle ? (
            <Pressable
              accessibilityRole="checkbox" accessibilityLabel={r.title} accessibilityState={{ checked: !!r.checked }}
              onPress={() => onToggle(i)} style={styles.target}
            >
              <View style={[styles.box, { borderColor: r.checked ? t.accent : t.muted, backgroundColor: r.checked ? t.accent : 'transparent' }]}>
                {r.checked ? <Text style={{ color: t.accentText, fontWeight: '700' }}>✓</Text> : null}
              </View>
            </Pressable>
          ) : null}
          <Pressable disabled={!onPress} onPress={() => onPress?.(i)} accessibilityRole={onPress ? 'button' : undefined}
            style={styles.body}>
            <Text style={[styles.title, { color: r.checked ? t.muted : t.text, textDecorationLine: r.checked ? 'line-through' : 'none' }]}>{r.title}</Text>
            {r.subtitle ? <Text style={[styles.sub, { color: t.muted }]}>{r.subtitle}</Text> : null}
          </Pressable>
          {r.trailing ? <Text style={[styles.sub, { color: t.muted }]}>{r.trailing}</Text> : null}
          {onDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${r.title}`} onPress={() => onDelete(i)} style={styles.target}>
              <Text style={{ color: t.danger, fontSize: 20 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET + 12 },
  target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: radius.control / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingVertical: 8 },
  title: { fontSize: 16 },
  sub: { fontSize: 14 },
});
