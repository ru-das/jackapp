import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, space, useTheme } from '@/ui/theme';

export function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      {title ? <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>{title}</Text> : null}
      {subtitle ? <Text style={[styles.subtitle, { color: t.muted }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  title: { fontSize: 19, fontWeight: '600' },
  subtitle: { fontSize: 14, marginTop: -space.sm },
});
