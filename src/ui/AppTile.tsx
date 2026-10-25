import { StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { AppIcon } from './AppIcon';
import { Icon, type IconName } from './Icon';
import { palettes, radius, useTheme } from './theme';

// Each saved app gets its own tint from its id, so the user's apps look like different things instead of one emoji in a white card.
const hue = (seed: string) => [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type Props = { emoji?: string; icon?: IconName; seed?: string; size?: number };

/** A square tile for an app or template. Decorative: the row around it names the app, so a screen reader skips the emoji. */
export function AppTile({ emoji, icon, seed, size = 48 }: Props) {
  const t = useTheme();
  const bg = seed ? `hsl(${hue(seed)}, 38%, ${t === palettes.dark ? 24 : 89}%)` : t.accentSoft;
  return (
    <View
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}
    >
      {emoji ? <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
        : icon ? <Icon name={icon} size={size * 0.5} color={t.accent} />
        : <AppIcon size={size * 0.7} />}
    </View>
  );
}

const styles = StyleSheet.create({ tile: { borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' } });
