import { StyleSheet, View } from 'react-native';
import { useTheme } from './theme';

/** Three dots drawn with views (like SettingsIcon), so the app needs no icon package. The button around it carries the label. */
export function MoreIcon() {
  const t = useTheme();
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, { backgroundColor: t.text }]} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { gap: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
