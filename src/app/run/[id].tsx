import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import type { createActionEngine } from '@/runtime/actions';
import { Renderer, type RendererHandle } from '@/runtime/Renderer';
import { createSession } from '@/runtime/session';
import { syncTriggers } from '@/runtime/triggers';
import type { Store } from '@/runtime/store';
import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { readJson, specKey } from '@/storage';
import { radius, space, useTheme } from '@/ui/theme';

type Loaded = { spec: Spec; store: Store; engine: ReturnType<typeof createActionEngine> };
type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | ({ kind: 'ready' } & Loaded);

export default function Run() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const navigateRef = useRef<RendererHandle['navigate']>(undefined);

  useEffect(() => {
    let store: Store | undefined;
    const abort = new AbortController();
    let live = true;
    (async () => {
      const raw = await readJson(specKey(id));
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
      void syncTriggers(id, spec, store.getState()).catch((e) => console.warn(`run/${id}: reminders not set`, e));
      if (live) setPhase({ kind: 'ready', spec, store: session.store, engine: session.engine });
    })().catch((e) => {
      console.error(`run/${id}: load failed`, e);
      if (live) setPhase({ kind: 'error', message: 'Something went wrong opening this mini-app.' });
    });
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') void store?.flush(); });
    return () => { live = false; abort.abort(); sub.remove(); void store?.flush(); };
  }, [id]);

  const title = phase.kind === 'ready' ? `${phase.spec.meta.icon ?? ''} ${phase.spec.meta.name}`.trim() : '';
  return (
    <View style={[styles.fill, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title }} />
      {phase.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Opening mini-app" color={t.accent} style={styles.spin} /> : null}
      {phase.kind === 'ready' ? <Renderer spec={phase.spec} store={phase.store} engine={phase.engine} onReady={(h) => { navigateRef.current = h.navigate; }} /> : null}
      {phase.kind === 'error' ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Can&apos;t open this one</Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>{phase.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: space.lg * 2 },
  card: { margin: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
});
