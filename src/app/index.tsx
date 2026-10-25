import { useRouter } from 'expo-router';
import { useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { RECIPES } from '@/ai/generator/recipes';
import { readSettings } from '@/ai/generator/recipes/settings';
import { h1, h2, h3 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { confirm, toast } from '@/capabilities';
import { specKey, writeJson } from '@/storage';
import { deleteApp, duplicateApp, listApps, newAppId, notifyAppsChanged, subscribeApps, renameApp, type AppSummary } from '@/storage/apps';
import { ActionButton } from '@/ui/ActionButton';
import { AppRow } from '@/ui/AppRow';
import { Card } from '@/ui/Card';
import { SettingsIcon } from '@/ui/SettingsIcon';
import { MIN_TARGET, pressed, radius, space, type, useTheme } from '@/ui/theme';

// Photo templates call the AI when used; Plant Pal never does.
const FIXTURES = [
  { id: 'fixture-h1', spec: h1, tag: 'Reading photos needs AI (set up in Settings).' },
  { id: 'fixture-h2', spec: h2, tag: 'Works right away.' },
  { id: 'fixture-h3', spec: h3, tag: 'Reading photos needs AI (set up in Settings).' },
];

// Built with the same recipe builders the AI path uses, so they are valid by construction and need no model.
const READY_MADE = [
  {
    label: 'Checklist', hint: 'Tick things off',
    spec: () => RECIPES.log.make(readSettings(`name Checklist
icon ✅
description Add things to do and tick them off
noun item
field name text Item
checkbox yes`), 'Checklist'),
  },
  {
    label: 'Tip Calculator', hint: 'Split a bill with a tip',
    spec: () => RECIPES.calculator.make(readSettings(`name Tip Calculator
icon 💵
description Work out the tip and what each person pays
input bill money Bill amount 80
input tip percent Tip 15
input people number People 2
output Tip = bill * tip / 100 as money
output Each person pays = (bill + bill * tip / 100) / people as money`), 'Tip Calculator'),
  },
];

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const top = useContext(SafeAreaInsetsContext)?.top ?? 0; // the header is hidden, so Home clears the status bar itself
  const [apps, setApps] = useState<AppSummary[] | 'error' | null>(null);
  const refresh = useCallback(() => { void listApps().then(setApps, (e) => { console.error('home: could not list apps', e); setApps('error'); }); }, []);
  useEffect(() => { refresh(); return subscribeApps(refresh); }, [refresh]);
  const duplicate = async (a: AppSummary) => {
    if (!(await duplicateApp(a.id, (n) => `${n.slice(0, 32)} (copy)`))) toast("Couldn't duplicate that one.");
    refresh();
  };
  const rename = async (a: AppSummary, name: string) => {
    if (!(await renameApp(a.id, name))) toast("Couldn't rename that one.");
    refresh();
  };
  const remove = async (a: AppSummary) => {
    if (!(await confirm(`Delete “${a.name}” and its data? This can't be undone.`))) return;
    try {
      await deleteApp(a.id);
    } catch {
      toast("Couldn't delete that one. Try again.");
    }
    refresh();
  };
  const open = async (id: string, spec: unknown) => {
    const errors = validate(spec);
    if (errors.length) {
      console.error('home: fixture invalid', errors);
      toast("This template is damaged, so we can't open it.");
      return;
    }
    try {
      await writeJson(specKey(id), spec);
    } catch {
      toast("Couldn't save. Try again.");
      return;
    }
    notifyAppsChanged();
    router.push({ pathname: '/run/[id]', params: { id } });
  };
  // A template is saved as the user's own copy so edits and data never touch the original.
  const tryTemplate = (spec: unknown) => open(newAppId(), spec);
  const remix = (spec: { meta: { name: string; description: string } }) => router.push({
    pathname: '/create',
    params: { prompt: `Like “${spec.meta.name}” (${spec.meta.description}), but ` },
  });
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingTop: top + space.md }]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>JackApp</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={(st) => [styles.gear, pressed(st)]}>
          <SettingsIcon />
        </Pressable>
      </View>
      <Text style={{ color: t.muted, fontSize: type.body }}>
        Describe a small mini-app and it gets built. Or try a ready-made one: it works right away, no AI needed.
      </Text>
      <ActionButton label="New mini-app" onPress={() => router.push('/create')} />
      <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Try a ready-made mini-app</Text>
      <View style={styles.tpl}>
        {READY_MADE.map((r) => (
          <View key={r.label} style={styles.flex}>
            <ActionButton kind="quiet" label={r.label} onPress={() => void tryTemplate(r.spec())} />
          </View>
        ))}
      </View>
      {apps === null ? <ActivityIndicator accessibilityLabel="Loading your mini-apps" color={t.accent} /> : null}
      {apps === 'error' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Couldn’t load your mini-apps</Text>
          <Text style={{ color: t.muted, fontSize: type.body }}>They are not lost. Storage did not answer. Try again.</Text>
          <ActionButton label="Try again" onPress={refresh} />
        </Card>
      ) : null}
      {apps !== 'error' && apps?.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.icon}>🦥</Text>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>No mini-apps yet</Text>
          <Text style={{ color: t.muted, fontSize: type.body, textAlign: 'center' }}>
            Describe a small mini-app and it gets built on your device.
          </Text>
        </Card>
      ) : null}
      {Array.isArray(apps) ? apps.map((a) => (
        <AppRow
          key={a.id} app={a} onOpen={() => router.push({ pathname: '/run/[id]', params: { id: a.id } })}
          onRename={(n) => void rename(a, n)} onDuplicate={() => void duplicate(a)} onDelete={() => void remove(a)}
        />
      )) : null}
      <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Examples to try</Text>
      {FIXTURES.map(({ id, spec, tag }) => (
        <Card key={id}>
          <View style={styles.tpl}>
            <Text style={styles.icon}>{spec.meta.icon}</Text>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: t.text }]}>{spec.meta.name}</Text>
              <Text style={{ color: t.muted, fontSize: type.meta }}>{spec.meta.description}</Text>
              <Text style={{ color: t.muted, fontSize: type.meta }}>{tag}</Text>
            </View>
          </View>
          <View style={styles.tpl}>
            <View style={styles.flex}><ActionButton label={`Try ${spec.meta.name}`} onPress={() => void tryTemplate(spec)} /></View>
            <View style={styles.flex}><ActionButton kind="quiet" label={`Make similar to ${spec.meta.name}`} onPress={() => remix(spec)} /></View>
          </View>
        </Card>
      ))}
      {__DEV__ ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Dev: load a fixture</Text>
          <Pressable
            accessibilityRole="button" onPress={() => router.push('/dev/eval')}
            style={[styles.row, { backgroundColor: t.accentSoft }]}
          >
            <Text style={[styles.name, { color: t.text }]}>Run model eval</Text>
          </Pressable>
          {FIXTURES.map(({ id, spec }) => (
            <Pressable
              key={id} accessibilityRole="button" accessibilityLabel={`Open ${spec.meta.name}`}
              onPress={() => void open(id, spec)} style={[styles.row, { backgroundColor: t.accentSoft }]}
            >
              <Text style={styles.icon}>{spec.meta.icon}</Text>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: t.text }]}>{spec.meta.name}</Text>
                <Text style={{ color: t.muted, fontSize: type.meta }}>{spec.meta.description}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: type.title, fontWeight: '700' },
  gear: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center' },
  h: { fontSize: type.h, fontWeight: '600', marginBottom: space.sm },
  row: { minHeight: MIN_TARGET + 12, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control },
  icon: { fontSize: 28 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  name: { fontSize: type.body, fontWeight: '600' },
});
