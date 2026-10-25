import { StyleSheet, View } from 'react-native';
import { useTheme } from './theme';

// Three sliders, drawn with views so the app needs no icon package. Rows are 8 px apart; knobs sit on the lines at different spots.
const KNOBS = [14, 5, 11];

export function SettingsIcon() {
  const t = useTheme();
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {KNOBS.map((x, i) => (
        <View key={i} style={[styles.row, { top: 2 + i * 8 }]}>
          <View style={[styles.line, { backgroundColor: t.text }]} />
          <View style={[styles.knob, { left: x, backgroundColor: t.bg, borderColor: t.text }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 24, height: 24 },
  row: { position: 'absolute', left: 0, right: 0, height: 4, justifyContent: 'center' },
  line: { height: 2, borderRadius: 1 },
  knob: { position: 'absolute', top: -2, width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
});
