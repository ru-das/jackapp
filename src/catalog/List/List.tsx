import { memo, useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';

export interface ListRow { key: string; title: string; subtitle?: string; trailing?: string; flag?: string; checked?: boolean }
interface Props {
  rows: ListRow[]; emptyText: string;
  onToggle?(i: number): void; onDelete?(i: number): void; onPress?(i: number): void;
}
type Handlers = Pick<Props, 'onToggle' | 'onDelete' | 'onPress'>;

export function List({ rows, emptyText, onToggle, onDelete, onPress }: Props) {
  const t = useTheme();
  // The parent builds fresh rows and closures on every keystroke anywhere in the mini-app; rows read the latest handlers from here, so an unchanged row is not rendered again.
  const handlers = useRef<Handlers>({});
  useLayoutEffect(() => { handlers.current = { onToggle, onDelete, onPress }; });
  if (rows.length === 0) return <Text accessibilityLabel={emptyText} style={[styles.empty, { color: t.muted }]}>🦥 {emptyText}</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <Item key={r.key} row={r} i={i} handlers={handlers} toggle={!!onToggle} del={!!onDelete} press={!!onPress} />
      ))}
    </View>
  );
}

interface ItemProps { row: ListRow; i: number; handlers: { current: Handlers }; toggle: boolean; del: boolean; press: boolean }

const sameItem = (a: ItemProps, b: ItemProps) =>
  a.i === b.i && a.toggle === b.toggle && a.del === b.del && a.press === b.press
  && a.row.title === b.row.title && a.row.subtitle === b.row.subtitle && a.row.trailing === b.row.trailing
  && a.row.flag === b.row.flag && a.row.checked === b.row.checked;

const Item = memo(function Item({ row: r, i, handlers, toggle, del, press }: ItemProps) {
  const t = useTheme();
  return (
    <View style={[styles.row, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      {toggle ? (
        <Pressable
          accessibilityRole="checkbox" accessibilityLabel={r.title} accessibilityState={{ checked: !!r.checked }}
          onPress={() => handlers.current.onToggle?.(i)} style={(st) => [styles.target, pressed(st)]}
        >
          <View style={[styles.box, { borderColor: r.checked ? t.accent : t.muted, backgroundColor: r.checked ? t.accent : 'transparent' }]}>
            {r.checked ? <Text maxFontSizeMultiplier={1.2} style={{ color: t.accentText, fontWeight: '700' }}>✓</Text> : null}
          </View>
        </Pressable>
      ) : null}
      <Pressable disabled={!press} onPress={() => handlers.current.onPress?.(i)} accessibilityRole={press ? 'button' : undefined}
        style={(st) => [styles.body, press && pressed(st)]}>
        <Text style={[styles.title, { color: r.checked ? t.muted : t.text, textDecorationLine: r.checked ? 'line-through' : 'none' }]}>{r.title}</Text>
        {r.subtitle ? <Text style={[styles.sub, { color: t.muted }]}>{r.subtitle}</Text> : null}
      </Pressable>
      {r.flag ? <Text style={[styles.sub, styles.flag, { color: t.danger }]} accessibilityLabel={`Needs checking: ${r.flag}`}>⚠ {r.flag}</Text>
        : r.trailing ? <Text style={[styles.sub, { color: t.muted }]}>{r.trailing}</Text> : null}
      {del ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${r.title}`} onPress={() => handlers.current.onDelete?.(i)} style={(st) => [styles.target, pressed(st)]}>
          <Text style={{ color: t.danger, fontSize: 20 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}, sameItem);

const styles = StyleSheet.create({
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: MIN_TARGET + 12 },
  target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: radius.control / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minHeight: MIN_TARGET, justifyContent: 'center', paddingVertical: space.sm },
  title: { fontSize: 16 },
  sub: { fontSize: 14 },
  flag: { flexShrink: 1, maxWidth: '45%', fontWeight: '600' },
});
