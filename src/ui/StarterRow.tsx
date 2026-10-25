import { StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { AppTile } from './AppTile';
import { Icon, type IconName } from './Icon';
import { font, MIN_TARGET, pressed, space, type, useTheme } from './theme';

type Props = {
  name: string; line: string; note?: string; emoji?: string; icon?: IconName;
  tryLabel: string; onTry(): void; similarLabel?: string; onSimilar?(): void;
};

/** One line in the "Start from something" list: tap the row to try it; the small button next to it starts a similar build. */
export function StarterRow({ name, line, note, emoji, icon, tryLabel, onTry, similarLabel, onSimilar }: Props) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Tap accessibilityRole="button" accessibilityLabel={tryLabel} onPress={onTry} style={(st) => [styles.main, pressed(st)]}>
        <AppTile emoji={emoji} icon={icon} />
        <View style={styles.text}>
          <Text style={{ color: t.text, fontSize: type.body, fontFamily: font.semibold }}>{name}</Text>
          <Text style={{ color: t.muted, fontSize: type.meta }}>{line}</Text>
          {note ? <Text style={{ color: t.muted, fontSize: type.meta }}>{note}</Text> : null}
        </View>
      </Tap>
      {onSimilar ? (
        <Tap accessibilityRole="button" accessibilityLabel={similarLabel} onPress={onSimilar} style={(st) => [styles.similar, pressed(st)]}>
          <Icon name="copy-outline" size={22} color={t.text} />
        </Tap>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, minHeight: MIN_TARGET + space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1 },
  similar: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
});
