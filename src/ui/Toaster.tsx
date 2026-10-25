import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { subscribeToast } from '@/capabilities';
import { radius, space, type, useTheme } from './theme';

const SHOW_MS = 2500;

export function Toaster() {
  const th = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => subscribeToast(setMessage), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLiveRegion="polite">
      <Text style={[styles.text, { backgroundColor: th.text, color: th.bg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.md, right: space.md, bottom: space.lg + space.sm, alignItems: 'center' },
  text: {
    paddingHorizontal: space.md, paddingVertical: 12,
    borderRadius: radius.control, overflow: 'hidden', fontSize: type.body,
  },
});
