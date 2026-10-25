import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
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
import { StarterRow } from '@/ui/StarterRow';
import { useInsets } from '@/ui/insets';
import { AppIcon } from '@/ui/AppIcon';
import { Icon } from '@/ui/Icon';
import { font, MIN_TARGET, pressed, radius, space, type, useTheme } from '@/ui/theme';

// Photo templates call the AI when used; Plant Pal never does.
const FIXTURES = [
  { id: 'fixture-h1', spec: h1, tag: 'Reading photos needs AI (set up in Settings).' },
  { id: 'fixture-h2', spec: h2, tag: 'Works right away.' },
  { id: 'fixture-h3', spec: h3, tag: 'Reading photos needs AI (set up in Settings).' },
];

// Built with the same recipe builders the AI path uses, so they are valid by construction and need no model.
const READY_MADE = [
  {
    label: 'Checklist', icon: 'checkbox-outline' as const, hint: 'Tick things off',
    spec: () => RECIPES.log.make(readSettings(`name Checklist
icon ✅
description Add things to do and tick them off
noun item
field name text Item
checkbox yes`), 'Checklist'),
  },
  {
    label: 'Tip Calculator', icon: 'calculator-outline' as const, hint: 'Split a bill with a tip',
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
  const { top, bottom } = useInsets(); // the header is hidden, so Home clears the status bar itself
  const [apps, setApps] = useState<AppSummary[] | 'error' | null>(null);
  const refresh = useCallback(() => { void listApps().then(setApps, (e) => { console.error('home: could not list apps', e); setApps('error'); }); }, []);
  useEffect(() => { refresh(); return subscribeApps(refresh); }, [refresh]);
  const duplicate = async (a: AppSummary) => {
    if (!(await duplicateApp(a.id, (n) => `${n.slice(0, 32)} (copy)`))) toast("Couldn’t duplicate that one.");
    refresh();
  };
  const rename = async (a: AppSummary, name: string) => {
    if (!(await renameApp(a.id, name))) toast("Couldn’t rename that one.");
    refresh();
  };
  const remove = async (a: AppSummary) => {
    if (!(await confirm('Its data goes too. This can’t be undone.', { title: `Delete “${a.name}”?`, confirmLabel: 'Delete', destructive: true }))) return;
    try {
      await deleteApp(a.id);
    } catch {
      toast("Couldn’t delete that one. Try again.");
    }
    refresh();
  };
  const open = async (id: string, spec: unknown) => {
    const errors = validate(spec);
    if (errors.length) {
      console.error('home: fixture invalid', errors);
      toast("This template is damaged, so we can’t open it.");
      return;
    }
    try {
      await writeJson(specKey(id), spec);
    } catch {
      toast("Couldn’t save. Try again.");
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
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingTop: top + space.md, paddingBottom: bottom + space.lg }]}>
      <View style={styles.head}>
        <View style={styles.brand}>
          <AppIcon size={40} />
          <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>JackApp</Text>
        </View>
        <Tap accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={(st) => [styles.gear, pressed(st)]}>
          <Icon name="settings-outline" size={26} color={t.text} />
        </Tap>
      </View>
      <ActionButton icon="add" label="New mini-app" onPress={() => router.push('/create')} />
      {apps === null ? <ActivityIndicator accessibilityLabel="Loading your mini-apps" color={t.accent} /> : null}
      {apps === 'error' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Couldn’t load your mini-apps</Text>
          <Text style={{ color: t.muted, fontSize: type.body }}>They are not lost. Storage did not answer. Try again.</Text>
          <ActionButton icon="refresh" label="Try again" onPress={refresh} />
        </Card>
      ) : null}
      {apps !== 'error' && apps?.length === 0 ? (
        <Card style={styles.empty}>
          <AppIcon size={72} />
          <Text accessibilityRole="header" style={[styles.h, styles.center, { color: t.text }]}>No mini-apps yet</Text>
          <Text style={{ color: t.muted, fontSize: type.body, textAlign: 'center' }}>
            Say what you need in a sentence. It gets built on your device and stays there.
          </Text>
        </Card>
      ) : null}
      {Array.isArray(apps) ? apps.map((a) => (
        <AppRow
          key={a.id} app={a} onOpen={() => router.push({ pathname: '/run/[id]', params: { id: a.id } })}
          onRename={(n) => void rename(a, n)} onDuplicate={() => void duplicate(a)} onDelete={() => void remove(a)}
        />
      )) : null}
      {/* Starters are for people with little of their own yet; once three apps exist they only push the user's work down. */}
      {apps !== null && !(Array.isArray(apps) && apps.length >= 3) ? (
        <>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Start from something</Text>
          <Card style={styles.starters}>
            {READY_MADE.map((r) => (
              <StarterRow key={r.label} name={r.label} line={r.hint} icon={r.icon} note="Works right away." tryLabel={r.label} onTry={() => void tryTemplate(r.spec())} />
            ))}
            {FIXTURES.map(({ id, spec, tag }) => (
              <StarterRow
                key={id} name={spec.meta.name} line={spec.meta.description} note={tag} emoji={spec.meta.icon}
                tryLabel={`Try ${spec.meta.name}`} onTry={() => void tryTemplate(spec)}
                similarLabel={`Make similar to ${spec.meta.name}`} onSimilar={() => remix(spec)}
              />
            ))}
          </Card>
        </>
      ) : null}
      {__DEV__ ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Dev: load a fixture</Text>
          <Tap
            accessibilityRole="button" onPress={() => router.push('/dev/eval')}
            style={[styles.row, { backgroundColor: t.accentSoft }]}
          >
            <Text style={[styles.name, { color: t.text }]}>Run model eval</Text>
          </Tap>
          {FIXTURES.map(({ id, spec }) => (
            <Tap
              key={id} accessibilityRole="button" accessibilityLabel={`Open ${spec.meta.name}`}
              onPress={() => void open(id, spec)} style={[styles.row, { backgroundColor: t.accentSoft }]}
            >
              <Text style={styles.icon}>{spec.meta.icon}</Text>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: t.text }]}>{spec.meta.name}</Text>
                <Text style={{ color: t.muted, fontSize: type.meta }}>{spec.meta.description}</Text>
              </View>
            </Tap>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: type.title, fontFamily: font.display },
  gear: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center' },
  center: { textAlign: 'center' },
  starters: { paddingVertical: space.sm, gap: space.none },
  h: { fontSize: type.h, fontFamily: font.display, marginBottom: space.sm },
  row: { minHeight: MIN_TARGET + 12, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control },
  icon: { fontSize: 28 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  name: { fontSize: type.body, fontFamily: font.semibold },
});
