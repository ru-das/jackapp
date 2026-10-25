import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { Icon } from '@/ui/Icon';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';
import type { ImageInputProps } from './props';

interface Props {
  label: string; value: string | null; source: ImageInputProps['source'];
  onPick(source: 'camera' | 'library'): void;
}

export function ImageInput({ label, value, source, onPick }: Props) {
  const t = useTheme();
  const btn = (text: string, s: 'camera' | 'library') => (
    <Tap key={s} accessibilityRole="button" accessibilityLabel={`${text}: ${label}`} onPress={() => onPick(s)}
      style={(st) => [styles.btn, { backgroundColor: t.accentSoft }, pressed(st)]}>
      <Icon name={s === 'camera' ? 'camera-outline' : 'images-outline'} size={18} color={t.accent} />
      <Text style={{ color: t.accent, fontWeight: '600', fontSize: 15 }}>{text}</Text>
    </Tap>
  );
  const verb = value ? 'Retake' : 'Take photo';
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      {value ? <Image source={{ uri: value }} accessibilityLabel={`${label} preview`} style={[styles.thumb, { backgroundColor: t.border }]} /> : null}
      <View style={styles.row}>
        {source !== 'library' ? btn(verb, 'camera') : null}
        {source !== 'camera' ? btn(value ? 'Choose another' : 'Choose photo', 'library') : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { fontSize: 14, fontWeight: '500' },
  thumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TARGET, paddingHorizontal: space.md, borderRadius: radius.control, justifyContent: 'center' },
});
