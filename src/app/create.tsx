import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { generate, type GenerationProgress } from '@/ai/generator/generate';
import type { Unsupported } from '@/ai/generator/outputSchemas';
import { getActiveProvider } from '@/ai/provider';
import { toast } from '@/capabilities';
import { Renderer } from '@/runtime/Renderer';
import { createSession } from '@/runtime/session';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { dataKey, removeKey, specKey, writeJson } from '@/storage';
import { notifyAppsChanged } from '@/storage/apps';
import { ActionButton } from '@/ui/ActionButton';
import { GenerationStages } from '@/ui/GenerationStages';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';
import { UnsupportedCard } from '@/ui/UnsupportedCard';

const EXAMPLES = [
  { label: 'Fridge Snap', prompt: "Take a photo of my fridge and make me a grocery list of what's running low" },
  { label: 'Plant Pal', prompt: 'Track which of my plants I watered and when, and remind me every Sunday morning' },
  { label: 'Bill Splitter', prompt: 'Photo of a restaurant bill → split it between friends' },
];

type Session = ReturnType<typeof createSession>;
type Draft = { id: string; spec: Spec; session: Session };
type Phase =
  | { kind: 'idle' } | { kind: 'loading' } | { kind: 'needsModel' }
  | { kind: 'working'; progress: Pick<GenerationProgress, 'stage' | 'attempt'> }
  | ({ kind: 'preview' } & Draft)
  | { kind: 'unsupported'; unsupported: Unsupported }
  | { kind: 'failed'; message: string };

export default function Create() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const draft = useRef<Draft | null>(null);

  // An unsaved preview must not leave its data behind.
  const discard = async () => {
    const d = draft.current;
    draft.current = null;
    if (!d) return;
    await d.session.store.flush();
    await removeKey(dataKey(d.id));
  };
  useEffect(() => () => { abort.current?.abort(); void discard(); }, []);

  const build = async (text: string) => {
    const request = text.trim();
    if (!request) return;
    const mine = ++run.current;
    const live = () => mine === run.current;
    abort.current?.abort();
    const controller = (abort.current = new AbortController());
    setPhase({ kind: 'loading' });
    await discard();
    try {
      const { provider, model } = await getActiveProvider();
      if (!(await provider.isConfigured())) return live() && setPhase({ kind: 'needsModel' });
      if (!live()) return;
      setPhase({ kind: 'working', progress: { stage: 'planning', attempt: 0 } });
      const result = await generate({
        prompt: request, provider, model, signal: controller.signal,
        onProgress: (e) => {
          if (live() && (e.stage === 'planning' || e.stage === 'building' || e.stage === 'checking' || e.stage === 'repairing')) {
            setPhase({ kind: 'working', progress: e });
          }
        },
      });
      if (!live()) return;
      if (result.status === 'unsupported') return setPhase({ kind: 'unsupported', unsupported: result.unsupported });
      if (result.status === 'failed') {
        console.error('create: generation failed', result.errors);
        return setPhase({ kind: 'failed', message: result.message });
      }
      const errors = validate(result.spec);
      if (errors.length) {
        console.error('create: generated spec invalid', errors);
        return setPhase({ kind: 'failed', message: 'I couldn’t build this mini-app. Try a simpler request.' });
      }
      const id = `app-${Date.now()}`;
      const next = { id, spec: result.spec, session: createSession(id, result.spec, controller.signal) };
      draft.current = next;
      setPhase({ kind: 'preview', ...next });
    } catch (error) {
      console.error('create: unexpected failure', error);
      if (live()) setPhase({ kind: 'failed', message: 'Something went wrong. Please try again.' });
    }
  };

  const cancel = () => { run.current++; abort.current?.abort(); setPhase({ kind: 'idle' }); };
  const save = async (d: Draft) => {
    if (validate(d.spec).length) return toast("This mini-app can't be saved.");
    await writeJson(specKey(d.id), d.spec);
    await d.session.store.flush();
    notifyAppsChanged();
    draft.current = null; // saved: the data now belongs to the mini-app
    router.replace({ pathname: '/run/[id]', params: { id: d.id } });
  };

  const busy = phase.kind === 'loading' || phase.kind === 'working';
  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];

  if (phase.kind === 'preview') {
    return (
      <View style={[styles.fill, { backgroundColor: t.bg }]}>
        <Text accessibilityRole="header" style={[styles.preview, { color: t.muted }]}>
          Preview · {phase.spec.meta.icon} {phase.spec.meta.name}
        </Text>
        <View style={styles.fill}>
          <Renderer spec={phase.spec} store={phase.session.store} engine={phase.session.engine}
            onReady={(h) => phase.session.setNavigate(h.navigate)} />
        </View>
        <View style={[styles.bar, { borderColor: t.border, backgroundColor: t.surface }]}>
          <View style={styles.flex}><ActionButton kind="quiet" label="Try again" onPress={() => void build(prompt)} /></View>
          <View style={styles.flex}><ActionButton label="Save" onPress={() => void save(phase)} /></View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: t.text }]}>What should your mini-app do?</Text>
      <TextInput
        accessibilityLabel="Describe your mini-app" multiline editable={!busy} value={prompt} onChangeText={setPrompt}
        maxLength={1000} placeholder="e.g. Track my daily water intake" placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: t.border }]}
      />
      <View style={styles.chips}>
        {EXAMPLES.map((e) => (
          <Pressable key={e.label} accessibilityRole="button" accessibilityLabel={`Example: ${e.label}`} disabled={busy}
            onPress={() => setPrompt(e.prompt)} style={[styles.chip, { backgroundColor: t.accentSoft }]}>
            <Text style={{ color: t.text, fontSize: 15 }}>{e.label}</Text>
          </Pressable>
        ))}
      </View>
      {busy ? <ActionButton kind="quiet" label="Cancel" onPress={cancel} />
        : <ActionButton label="Build" disabled={!prompt.trim()} onPress={() => void build(prompt)} />}

      {phase.kind === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.wait}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.muted, fontSize: 16 }}>Getting started…</Text>
        </View>
      ) : null}
      {phase.kind === 'working' ? <GenerationStages progress={phase.progress} /> : null}
      {phase.kind === 'needsModel' ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Set up AI first</Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>JackApp needs an OpenRouter key (free) or an Ollama model to build mini-apps.</Text>
          <ActionButton label="Open settings" onPress={() => router.push('/settings')} />
        </View>
      ) : null}
      {phase.kind === 'failed' ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>That didn’t work</Text>
          <Text style={{ color: t.muted, fontSize: 16 }}>{phase.message}</Text>
          <ActionButton label="Try again" onPress={() => void build(prompt)} />
        </View>
      ) : null}
      {phase.kind === 'unsupported' ? (
        <UnsupportedCard unsupported={phase.unsupported}
          onBuildSuggestion={() => { setPrompt(phase.unsupported.suggestion); void build(phase.unsupported.suggestion); }} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 18, fontWeight: '600' },
  input: { minHeight: 110, padding: space.md, borderRadius: radius.control, borderWidth: 1, fontSize: 16, textAlignVertical: 'top' },
  wait: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
  preview: { fontSize: 14, paddingHorizontal: space.lg, paddingTop: space.sm },
  bar: { flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
