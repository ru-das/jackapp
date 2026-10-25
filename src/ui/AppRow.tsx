import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import type { AppSummary } from '@/storage/apps';
import { ActionButton } from './ActionButton';
import { AppTile } from './AppTile';
import { Icon, type IconName } from './Icon';
import { font, MIN_TARGET, pressed, radius, space, type, useTheme } from './theme';

type Props = {
  app: AppSummary; onOpen(): void; onRename(name: string): void; onDuplicate(): void; onDelete(): void;
};

export function AppRow({ app, onOpen, onRename, onDuplicate, onDelete }: Props) {
  const t = useTheme();
  const [name, setName] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  // Actions are tucked away until asked for, so ten saved apps are ten rows, not thirty buttons with Delete one tap away.
  const small = (label: string, icon: IconName, onPress: () => void, danger?: boolean) => (
    <View style={styles.flex}>
      <ActionButton kind={danger ? 'danger' : 'quiet'} icon={icon} label={label} accessibilityLabel={`${label} ${app.name}`} onPress={() => { setMore(false); onPress(); }} />
    </View>
  );
  return (
    <View style={[styles.card, { borderColor: t.border }]}>
      {name === null ? (
        <View style={styles.head}>
          <Tap accessibilityRole="button" accessibilityLabel={`Open ${app.name}`} onPress={onOpen} style={(st) => [styles.title, pressed(st)]}>
            <AppTile emoji={app.icon || undefined} seed={app.id} />
            <Text style={[styles.name, { color: t.text }]}>{app.name}</Text>
          </Tap>
          <Tap
            accessibilityRole="button" accessibilityLabel={`More actions for ${app.name}`} accessibilityState={{ expanded: more }}
            onPress={() => setMore(!more)} style={(st) => [styles.more, pressed(st)]}
          >
            <Icon name="ellipsis-vertical" size={24} color={t.text} />
          </Tap>
        </View>
      ) : (
        <>
          <TextInput accessibilityLabel={`New name for ${app.name}`} value={name} onChangeText={setName} maxLength={40} autoFocus
            style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.outline }]} />
          <View style={styles.actions}>
            <View style={styles.flex}><ActionButton kind="quiet" icon="close" label="Cancel" onPress={() => setName(null)} /></View>
            <View style={styles.flex}><ActionButton icon="checkmark" label="Save name" disabled={!name.trim()} onPress={() => { onRename(name); setName(null); }} /></View>
          </View>
        </>
      )}
      {name === null && more ? (
        <View style={styles.actions}>
          {app.damaged ? null : small('Rename', 'pencil', () => setName(app.name))}
          {app.damaged ? null : small('Duplicate', 'copy-outline', onDuplicate)}
          {small('Delete', 'trash-outline', onDelete, true)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // A flat row with a hairline under it: a list of apps reads as one list, and bordered cards are kept for moments that need them.
  card: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.md },
  more: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: type.h, fontFamily: font.display },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1 },
  input: { minHeight: MIN_TARGET, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: type.body },
});
