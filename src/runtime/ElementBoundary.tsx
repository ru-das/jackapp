import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/ui/theme';

interface Props { id: string; children: ReactNode }

function Fallback() {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: t.dangerSoft }]}>
      <Text style={[styles.text, { color: t.danger }]}>🦥 This bit dozed off. The rest still works.</Text>
    </View>
  );
}

export class ElementBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.error(`Element "${this.props.id}" failed to render`, error);
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14 },
  text: { fontSize: 14 },
});
