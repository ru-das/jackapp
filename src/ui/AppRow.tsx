import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from './Card';
import type { AppSummary } from '@/storage/apps';
import { ActionButton } from './ActionButton';
import { MIN_TARGET, pressed, radius, space, type, useTheme } from './theme';

type Props = {
  app: AppSummary; onOpen(): void; onRename(name: string): void; onDuplicate(): void; onDelete(): void;
};

export function AppRow({ app, onOpen, onRename, onDuplicate, onDelete }: Props) {
  const t = useTheme();
  const [name, setName] = useState<string | null>(null);
  const small = (label: string, onPress: () => void, danger?: boolean) => (
    <View style={styles.flex}>
      <ActionButton kind={danger ? 'danger' : 'quiet'} label={label} accessibilityLabel={`${label} ${app.name}`} onPress={onPress} />
    </View>
  );
  return (
    <Card style={styles.card}>
      {name === null ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${app.name}`} onPress={onOpen} style={(st) => [styles.title, pressed(st)]}>
          <Text style={styles.icon}>{app.icon ?? '🦥'}</Text>
          <Text style={[styles.name, { color: t.text }]}>{app.name}</Text>
        </Pressable>
      ) : (
        <>
          <TextInput accessibilityLabel={`New name for ${app.name}`} value={name} onChangeText={setName} maxLength={40} autoFocus
            style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.outline }]} />
          <View style={styles.actions}>
            <View style={styles.flex}><ActionButton kind="quiet" label="Cancel" onPress={() => setName(null)} /></View>
            <View style={styles.flex}><ActionButton label="Save name" disabled={!name.trim()} onPress={() => { onRename(name); setName(null); }} /></View>
          </View>
        </>
      )}
      {name === null && !app.damaged ? (
        <View style={styles.actions}>
          {small('Rename', () => setName(app.name))}
          {small('Duplicate', onDuplicate)}
          {small('Delete', onDelete, true)}
        </View>
      ) : null}
      {name === null && app.damaged ? <View style={styles.actions}>{small('Delete', onDelete, true)}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md },
  title: { minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 28 },
  name: { flex: 1, fontSize: type.h, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1 },
  input: { minHeight: MIN_TARGET, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: type.body },
});
