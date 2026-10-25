import { useEffect } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tap } from '@/ui/Tap';
import { MIN_TARGET, pressed, radius, space, type, useTheme } from './theme';

type Item = { label: string; onPress(): void };

/** A small menu under the top-right corner, for actions that matter less than the screen's own content. Tapping outside or system Back closes it. */
export function OverflowMenu({ items, onClose }: { items: Item[]; onClose(): void }) {
  const t = useTheme();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityRole="menu" style={[styles.panel, { backgroundColor: t.surface }]}>
        {items.map((item) => (
          <Tap key={item.label} accessibilityRole="menuitem" onPress={() => { onClose(); item.onPress(); }} style={(st) => [styles.item, pressed(st)]}>
            <Text style={{ color: t.text, fontSize: type.body }}>{item.label}</Text>
          </Tap>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', top: space.xs, right: space.sm, minWidth: 200, paddingVertical: space.xs, borderRadius: radius.control,
    ...Platform.select({ web: { boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }, default: { elevation: 6 } }),
  },
  item: { minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: space.md },
});
