import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { share, toast } from '@/capabilities';
import { toCsv } from '@/runtime/export';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import type { createActionEngine } from '@/runtime/actions';
import { Renderer, type RendererHandle } from '@/runtime/Renderer';
import { createSession } from '@/runtime/session';
import { syncTriggers, type SyncResult } from '@/runtime/triggers';
import type { Store } from '@/runtime/store';
import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { readJson, specKey, StorageError } from '@/storage';
import { subscribeApps } from '@/storage/apps';
import { loadSettings } from '@/storage/settings';
import { ActionButton } from '@/ui/ActionButton';
import { ReminderStatus } from '@/ui/ReminderStatus';
import { UndoBar } from '@/ui/UndoBar';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

type Loaded = { spec: Spec; store: Store; engine: ReturnType<typeof createActionEngine> };
type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & Loaded);

export default function Run() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [reminders, setReminders] = useState<SyncResult>();
  const navigateRef = useRef<RendererHandle['navigate']>(undefined);
  const router = useRouter();
  // Customize saves a rebuilt spec while this screen is still mounted underneath; reload it.
  const [rev, setRev] = useState(0);
  useEffect(() => subscribeApps(() => setRev((n) => n + 1)), []);

  useEffect(() => {
    let store: Store | undefined;
    const abort = new AbortController();
    let live = true;
    let resync = () => Promise.resolve();
    (async () => {
      await loadSettings(); // warms the currency preference before the first render
      const raw = await readJson(specKey(id)).catch((e) => {
        if (e instanceof StorageError && e.kind === 'unreadable') return {}; // fails validate() below: damaged
        throw e;
      });
      if (raw === null) return live && setPhase({ kind: 'error', message: "We couldn't find this mini-app." });
      const errors = validate(raw);
      if (errors.length) {
        console.error(`run/${id}: spec invalid`, errors);
        return live && setPhase({ kind: 'error', message: "This mini-app is damaged, so we can't open it." });
      }
      const spec = SpecSchema.parse(raw);
      const session = createSession(id, spec, abort.signal);
      store = session.store;
      await store.load();
      session.setNavigate((to) => navigateRef.current?.(to));
      // Reminders are set (or replaced) each time the app opens; this never blocks showing the app.
      const sync = () => syncTriggers(id, spec, store!.getState()).then((r) => { if (live) setReminders(r); }).catch((e) => console.warn(`run/${id}: reminders not set`, e));
      void sync();
      resync = sync;
      if (live) setPhase({ kind: 'ready', spec, store: session.store, engine: session.engine });
    })().catch((e) => {
      console.error(`run/${id}: load failed`, e);
      const unavailable = e instanceof StorageError;
      if (live) setPhase({ kind: 'error', message: unavailable ? "We couldn't reach your saved data, so nothing was opened. Close the app and try again." : 'Something went wrong opening this mini-app.' });
    });
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') void store?.flush().catch(() => {}); else void resync(); }); // coming back may follow turning notifications on in system settings
    return () => { live = false; abort.abort(); sub.remove(); void store?.flush().catch(() => {}); };
  }, [id, rev]);

  const title = phase.kind === 'ready' ? `${phase.spec.meta.icon ?? ''} ${phase.spec.meta.name}`.trim() : 'Mini-app';
  return (
    <View style={[styles.fill, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title, headerRight: phase.kind === 'ready' ? () => (
        <View style={styles.row}>
        {phase.spec.meta.recipe ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Customize this mini-app" style={styles.export}
            onPress={() => void phase.store.flush().catch(() => {}).then(() => router.push({ pathname: '/edit/[id]', params: { id } }))}>
            <Text style={{ color: t.accent, fontSize: 16 }}>Customize</Text>
          </Pressable>) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Export data as CSV" onPress={() => void share(toCsv(phase.spec, phase.store.getState())).catch(() => toast("Couldn't export."))} style={styles.export}>
          <Text style={{ color: t.accent, fontSize: 16 }}>Export</Text>
        </Pressable>
        </View>) : undefined }} />
      {phase.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Opening mini-app" color={t.accent} style={styles.spin} /> : null}
      {phase.kind === 'ready' && reminders ? <ReminderStatus appId={id} result={reminders} /> : null}
      {phase.kind === 'ready' ? <Renderer spec={phase.spec} store={phase.store} engine={phase.engine} onReady={(h) => { navigateRef.current = h.navigate; }} /> : null}
      {phase.kind === 'ready' ? <UndoBar store={phase.store} /> : null}
      {phase.kind === 'error' ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Can&apos;t open this one</Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>{phase.message}</Text>
          <ActionButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  export: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: space.sm, justifyContent: 'center' },
  spin: { marginTop: space.lg * 2 },
  card: { margin: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
});
