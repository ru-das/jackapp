import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from '@/ui/Tap';
import type { Store } from '@/runtime/store';
import { useAnnounce } from '@/ui/announce';
import { useInsets } from '@/ui/insets';
import { inverse, MIN_TARGET, pressed, radius, space, type, useTheme } from '@/ui/theme';

const SHOW_MS = 8000;

export function UndoBar({ store }: { store: Store }) {
  const snack = inverse(useTheme());
  const { bottom } = useInsets();
  const removal = useSyncExternalStore(store.subscribe, store.lastRemoval);
  const [hidden, setHidden] = useState<unknown>(null);

  useEffect(() => {
    if (!removal) return;
    const timer = setTimeout(() => setHidden(removal), SHOW_MS);
    return () => clearTimeout(timer);
  }, [removal]);

  const shown = removal && hidden !== removal ? removal : null;
  const text = shown ? `Removed ${shown.removed} ${shown.removed === 1 ? 'item' : 'items'}` : '';
  useAnnounce(shown ? `${text}. Undo is available.` : null);
  if (!shown) return null;
  return (
    <View style={[styles.bar, { backgroundColor: snack.bg, bottom: 88 + bottom }]}>
      <Text style={[styles.text, { color: snack.fg }]}>{text}</Text>
      <Tap accessibilityRole="button" accessibilityLabel="Undo remove" onPress={() => store.undo()} style={(st) => [styles.target, pressed(st)]}>
        <Text style={[styles.undo, { color: snack.accent }]}>Undo</Text>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: space.md, right: space.md, maxWidth: 608, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingLeft: space.md, borderRadius: radius.control,
  },
  text: { fontSize: type.body, flexShrink: 1 },
  target: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: space.md, justifyContent: 'center' },
  undo: { fontSize: type.body, fontWeight: '600' },
});
