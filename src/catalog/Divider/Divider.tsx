import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/ui/theme';

export function Divider() {
  const t = useTheme();
  return <View accessibilityElementsHidden style={[styles.line, { backgroundColor: t.border }]} />;
}

const styles = StyleSheet.create({ line: { height: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch' } });
