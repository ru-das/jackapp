import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RECIPES } from '@/ai/generator/recipes';
import { rebuild } from '@/ai/generator/recipes/rebuild';
import { readSettings } from '@/ai/generator/recipes/settings';
import { confirm, toast } from '@/capabilities';
import { dataAtRisk } from '@/runtime/migrate';
import type { Spec } from '@/spec/types';
import { dataKey, readJson, specKey, writeJson } from '@/storage';
import { duplicateApp, loadValid, notifyAppsChanged } from '@/storage/apps';
import { ActionButton } from '@/ui/ActionButton';
import { useInsets } from '@/ui/insets';
import { MIN_TARGET, radius, space, type, useTheme } from '@/ui/theme';

const keysOf = (text: string) => [...readSettings(text).keys()];

// Setting keys are written for the builder; these are the words people see.
const LABELS: Record<string, string> = {
  name: 'Name', icon: 'Icon', description: 'Description', noun: 'What one entry is called', field: 'Fields (one per line)', checkbox: 'Tick boxes (yes or no)',
  total: 'Totals (one per line)', tap: 'When an entry is tapped', sort: 'Sort order', share: 'Share button (yes or no)', photo: 'Read from a photo (yes or no)',
  reminder: 'Reminders (one per line)', instruction: 'What to ask the AI', usual: 'Usual items (comma separated)', button: 'Button text', history: 'Keep past answers (yes or no)',
  label: 'Label', minutes: 'Length in minutes', count: 'Count finished timers (yes or no)', step: 'Add this much each time', message: 'Reminder message',
  done: 'Done button (yes or no)', input: 'Inputs (one per line)', output: 'Results (one per line)',
};
const labelOf = (k: string) => LABELS[k] ?? k;

/** Customize (ADR-039): edit the setting lines a recipe app was built from, then rebuild through the same validated builder. */
export default function Customize() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { bottom } = useInsets();
  const router = useRouter();
  const [spec, setSpec] = useState<Spec | null | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadValid(id).then((s) => {
      setSpec(s);
      const info = s?.meta.recipe;
      if (!s || !info) return;
      const saved = readSettings(info.settings);
      setValues(Object.fromEntries(keysOf(info.settings).map((k) => [k, (saved.get(k) ?? []).join('\n')])));
    });
  }, [id]);

  const info = spec?.meta.recipe;
  if (spec === undefined) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator accessibilityLabel="Opening settings" color={t.accent} style={{ marginTop: space.lg * 2 }} /></View>;
  if (!spec || !info) {
    return (
      <View style={[styles.pad, { backgroundColor: t.bg, flex: 1 }]}>
        <Text style={{ color: t.text, fontSize: type.body }}>
          {spec ? 'This one wasn’t built from a ready-made type, so it can’t be customized. Tap New mini-app on Home to start a new one.' : 'We couldn’t open this mini-app.'}
        </Text>
        <ActionButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      </View>
    );
  }
  const recipe = RECIPES[info.id];
  // Settings the model left out still get a box, so they can be set.
  const keys = [...new Set([...Object.keys(values), ...keysOf(recipe.example.reply)])];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const text = keys.flatMap((k) => (values[k] ?? '').split('\n').map((v) => v.trim()).filter(Boolean).map((v) => `${k} ${v}`)).join('\n');
      const result = rebuild(spec, text);
      if (!result.ok) return setError(result.message);
      const saved = await readJson(dataKey(id)).catch(() => null);
      const risk = dataAtRisk(spec, result.spec, saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {});
      if (risk.length) {
        const ok = await confirm(`Saved data for ${risk.join(', ')} won’t show in the new version. OK saves the old version as a copy first.`);
        if (!ok) return;
        if (!(await duplicateApp(id, (n) => `${n.slice(0, 33)} (old)`, true))) return setError("Couldn’t keep a copy, so nothing was changed.");
      }
      await writeJson(specKey(id), result.spec);
      notifyAppsChanged();
      if (result.notes.length) toast(result.notes[0]);
      router.back();
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.pad, { paddingBottom: space.lg + bottom }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `Customize ${spec.meta.name}` }} />
      <Text style={{ color: t.muted, fontSize: type.body }}>Change the settings this mini-app was built from. Your saved data stays unless a change would hide it; you’ll be asked first.</Text>
      {keys.map((k) => (
        <View key={k} style={{ gap: space.xs }}>
          <Text style={{ color: t.text, fontSize: type.body, fontWeight: '600' }}>{labelOf(k)}</Text>
          <TextInput
            accessibilityLabel={labelOf(k)} multiline value={values[k] ?? ''} onChangeText={(v) => setValues((s) => ({ ...s, [k]: v }))}
            style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: t.border }]}
          />
        </View>
      ))}
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: type.body }}>{error}</Text> : null}
      <ActionButton label={busy ? 'Saving…' : 'Save changes'} onPress={() => void save()} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  input: { minHeight: MIN_TARGET, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: 10, fontSize: type.body },
});
