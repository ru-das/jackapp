import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { subscribeToast } from '@/capabilities';
import { useInsets } from './insets';
import { inverse, radius, space, type, useTheme } from './theme';

const SHOW_MS = 2500;

export function Toaster() {
  const snack = inverse(useTheme());
  const { bottom } = useInsets();
  // An object, not the string: the same text shown twice is a new toast that must be spoken again and get a fresh timer.
  const [toast, setToast] = useState<{ text: string } | null>(null);

  useEffect(() => subscribeToast((text) => setToast({ text })), []);
  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.text);
    const t = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const message = toast.text;
  return (
    <View style={[styles.wrap, { bottom: space.lg + space.sm + bottom }]} pointerEvents="none">
      <Text style={[styles.text, { backgroundColor: snack.bg, color: snack.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, maxWidth: 608, alignSelf: 'center', alignItems: 'center' },
  text: {
    paddingHorizontal: space.md, paddingVertical: 12,
    borderRadius: radius.control, overflow: 'hidden', fontSize: type.body,
  },
});
