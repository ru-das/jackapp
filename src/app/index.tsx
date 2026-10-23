import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { h1, h2, h3 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { confirm, toast } from '@/capabilities';
import { specKey, writeJson } from '@/storage';
import { deleteApp, duplicateApp, listApps, newAppId, notifyAppsChanged, subscribeApps, renameApp, type AppSummary } from '@/storage/apps';
import { ActionButton } from '@/ui/ActionButton';
import { AppRow } from '@/ui/AppRow';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const FIXTURES = [
  { id: 'fixture-h1', spec: h1 },
  { id: 'fixture-h2', spec: h2 },
  { id: 'fixture-h3', spec: h3 },
];

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const [apps, setApps] = useState<AppSummary[] | null>(null);
  const refresh = useCallback(() => { void listApps().then(setApps); }, []);
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
    await deleteApp(a.id);
    refresh();
  };
  const open = async (id: string, spec: unknown) => {
    const errors = validate(spec);
    if (errors.length) {
      console.error('home: fixture invalid', errors);
      toast("This template is damaged, so we can't open it.");
      return;
    }
    await writeJson(specKey(id), spec);
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
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>JackApp</Text>
      {apps?.length === 0 ? (
        <View style={[styles.card, styles.empty, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={styles.icon}>🦥</Text>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>No mini-apps yet</Text>
          <Text style={{ color: t.muted, fontSize: 16, textAlign: 'center' }}>
            Tell me a chore you’d rather not do. I’ll build the app. Slowly.
          </Text>
        </View>
      ) : null}
      {apps?.map((a) => (
        <AppRow
          key={a.id} app={a} onOpen={() => router.push({ pathname: '/run/[id]', params: { id: a.id } })}
          onRename={(n) => void rename(a, n)} onDuplicate={() => void duplicate(a)} onDelete={() => void remove(a)}
        />
      ))}
      <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Start from a template</Text>
      {FIXTURES.map(({ id, spec }) => (
        <View key={id} style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <View style={styles.tpl}>
            <Text style={styles.icon}>{spec.meta.icon}</Text>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: t.text }]}>{spec.meta.name}</Text>
              <Text style={{ color: t.muted, fontSize: 14 }}>{spec.meta.description}</Text>
            </View>
          </View>
          <View style={styles.tpl}>
            <View style={styles.flex}><ActionButton label={`Try ${spec.meta.name}`} onPress={() => void tryTemplate(spec)} /></View>
            <View style={styles.flex}><ActionButton kind="quiet" label={`Remix ${spec.meta.name}`} onPress={() => remix(spec)} /></View>
          </View>
        </View>
      ))}
      {([['New mini-app', '/create'], ['Settings', '/settings']] as const).map(([label, to]) => (
        <Pressable
          key={to} accessibilityRole="button" onPress={() => router.push(to)}
          style={[styles.nav, { backgroundColor: to === '/create' ? t.accent : t.surface, borderColor: t.border }]}
        >
          <Text style={[styles.name, { color: to === '/create' ? t.accentText : t.text }]}>{label}</Text>
        </Pressable>
      ))}
      {__DEV__ ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
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
                <Text style={{ color: t.muted, fontSize: 14 }}>{spec.meta.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '700' },
  empty: { alignItems: 'center' },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 17, fontWeight: '600', marginBottom: space.sm },
  row: { minHeight: MIN_TARGET + 12, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control },
  nav: { minHeight: MIN_TARGET + 8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', padding: space.md },
  icon: { fontSize: 28 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
});
