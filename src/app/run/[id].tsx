import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { confirm, share, toast } from '@/capabilities';
import { createActionEngine } from '@/runtime/actions';
import { Renderer, type RendererHandle } from '@/runtime/Renderer';
import { createStore, type Store } from '@/runtime/store';
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
      store = createStore(id, spec.state);
      await store.load();
      const s = store;
      const engine = createActionEngine({
        spec, store: s,
        services: { share, toast, confirm, navigate: (to) => navigateRef.current?.(to) },
        getValueContext: () => ({
          now: new Date(), locale: Intl.DateTimeFormat().resolvedOptions().locale,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD', // shortcut: same fixed currency as Renderer, until settings exist
          onWarning: (m) => console.warn(`spec: ${m}`),
        }),
      });
      if (live) setPhase({ kind: 'ready', spec, store: s, engine });
    })().catch((e) => {
      console.error(`run/${id}: load failed`, e);
      if (live) setPhase({ kind: 'error', message: 'Something went wrong opening this mini-app.' });
    });
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') void store?.flush(); });
    return () => { live = false; sub.remove(); void store?.flush(); };
  }, [id]);

  const title = phase.kind === 'ready' ? `${phase.spec.meta.icon ?? ''} ${phase.spec.meta.name}`.trim() : '';
  return (
    <View style={[styles.fill, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title }} />
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
  card: { margin: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
});
