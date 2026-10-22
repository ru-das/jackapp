import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props { id: string; children: ReactNode }

export class ElementBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.error(`Element "${this.props.id}" failed to render`, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View accessibilityRole="alert" style={styles.card}>
        <Text style={styles.text}>This part broke. The rest of the app still works.</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, backgroundColor: '#F6E3DE' },
  text: { color: '#8A3B2A', fontSize: 14 },
});
