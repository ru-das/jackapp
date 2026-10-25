import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Store } from '@/runtime/store';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const SHOW_MS = 8000;

export function UndoBar({ store }: { store: Store }) {
  const t = useTheme();
  const removal = useSyncExternalStore(store.subscribe, store.lastRemoval);
  const [hidden, setHidden] = useState<unknown>(null);

  useEffect(() => {
    if (!removal) return;
    const timer = setTimeout(() => setHidden(removal), SHOW_MS);
    return () => clearTimeout(timer);
  }, [removal]);

  if (!removal || hidden === removal) return null;
  return (
    <View style={[styles.bar, { backgroundColor: t.surface, borderColor: t.border }]} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: t.text }]}>Removed {removal.removed} {removal.removed === 1 ? 'item' : 'items'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Undo remove" onPress={() => store.undo()} style={styles.target}>
        <Text style={[styles.undo, { color: t.accent }]}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: space.md, right: space.md, bottom: 88, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingLeft: space.md, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 16, flexShrink: 1 },
  target: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: space.md, justifyContent: 'center' },
  undo: { fontSize: 16, fontWeight: '600' },
});
