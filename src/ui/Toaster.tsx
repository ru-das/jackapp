import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { subscribeToast } from '@/capabilities';

const SHOW_MS = 2500;

export function Toaster() {
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
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 32, alignItems: 'center' },
  text: {
    backgroundColor: '#222', color: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 8, overflow: 'hidden', fontSize: 16,
  },
});
