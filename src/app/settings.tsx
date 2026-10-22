import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm } from '@/capabilities';
import { ggufBytes, MODELS, type ModelId } from '@/ai/models';
import { getProvider } from '@/ai/provider';
import { loadSettings, saveSettings, type Settings } from '@/storage/settings';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

export default function SettingsScreen() {
  const t = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const provider = settings ? getProvider(settings.provider) : null;
  const [checks, setChecks] = useState(0);
  const refresh = () => setChecks((n) => n + 1);

  useEffect(() => { void loadSettings().then(setSettings); }, []);
  useEffect(() => {
    let live = true;
    void (provider?.isDownloaded() ?? Promise.resolve(false)).then((d) => { if (live) setDownloaded(d); });
    return () => { live = false; };
  }, [provider, settings?.model, checks]);

  const update = async (patch: Partial<Settings>) => {
    if (!settings || progress) return;
    const next = { ...settings, ...patch };
    await saveSettings(next);
    await getProvider(next.provider).setModel(next.model);
    setSettings(next);
    setError('');
  };

  const download = async () => {
    if (!provider || progress) return;
    setError('');
    setProgress({ loaded: 0, total: settings?.provider === 'local' ? ggufBytes(settings.model) : 1 });
    try {
      await provider.load((p) => setProgress(p));
    } catch (e) {
      console.error('settings: download failed', e);
      setError(e instanceof Error ? e.message : 'Download failed. Check your connection and try again.');
    }
    setProgress(null);
    refresh();
  };

  const remove = async () => {
    if (!provider || !(await confirm('Delete the downloaded model? You can download it again later.'))) return;
    await provider.remove();
    refresh();
  };

  if (!settings || !provider) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  const status = progress ? 'Downloading…' : provider.status() === 'ready' ? 'Loaded' : downloaded ? 'Downloaded' : 'Not downloaded';
  const pct = progress ? Math.min(100, Math.round((progress.loaded / Math.max(progress.total, 1)) * 100)) : 0;
  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Model</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>
          Runs on this device. The only network use is downloading the model.
        </Text>
        {(Object.keys(MODELS) as ModelId[]).map((id) => {
          const on = settings.model === id;
          return (
            <Pressable
              key={id} accessibilityRole="radio" accessibilityState={{ selected: on }}
              accessibilityLabel={`${MODELS[id].label}, ${gb(ggufBytes(id))} GB`}
              onPress={() => void update({ model: id })}
              style={[styles.row, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.border }]}
            >
              <Text style={[styles.name, { color: t.text }]}>{MODELS[id].label} · {gb(ggufBytes(id))} GB</Text>
              <Text style={{ color: t.muted, fontSize: 14 }}>{MODELS[id].note}</Text>
            </Pressable>
          );
        })}
        <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: 16 }}>Status: {status}</Text>
        {progress ? (
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
            <View style={[styles.bar, { backgroundColor: t.accentSoft }]}>
              <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
            </View>
            <Text style={{ color: t.muted, fontSize: 14 }}>{gb(progress.loaded)} of {gb(progress.total)} GB</Text>
          </View>
        ) : null}
        {error ? <Text style={{ color: t.danger, fontSize: 15 }}>{error}</Text> : null}
        {!downloaded && !progress ? (
          <Pressable accessibilityRole="button" onPress={() => void download()} style={[styles.btn, { backgroundColor: t.accent }]}>
            <Text style={[styles.btnText, { color: t.accentText }]}>Download model</Text>
          </Pressable>
        ) : null}
        {downloaded && !progress ? (
          <Pressable accessibilityRole="button" onPress={() => void remove()} style={[styles.btn, { backgroundColor: t.dangerSoft }]}>
            <Text style={[styles.btnText, { color: t.danger }]}>Delete model</Text>
          </Pressable>
        ) : null}
      </View>
      {__DEV__ ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Dev: provider</Text>
          {(['local', 'mock'] as const).map((id) => (
            <Pressable
              key={id} accessibilityRole="radio" accessibilityState={{ selected: settings.provider === id }}
              onPress={() => void update({ provider: id })}
              style={[styles.row, { backgroundColor: settings.provider === id ? t.accentSoft : 'transparent', borderColor: t.border }]}
            >
              <Text style={[styles.name, { color: t.text }]}>{id === 'local' ? 'On-device model' : 'Mock (no model)'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
  row: { minHeight: MIN_TARGET, padding: space.md, borderRadius: radius.control, borderWidth: 1, gap: 2, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  bar: { height: 8, borderRadius: 4, marginBottom: 4 },
  btn: { minHeight: MIN_TARGET, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', padding: space.md },
  btnText: { fontSize: 16, fontWeight: '600' },
});
