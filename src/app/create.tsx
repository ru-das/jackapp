import { useFocusEffect, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { generate, type GenerationProgress } from '@/ai/generator/generate';
import type { Unsupported } from '@/ai/generator/outputSchemas';
import { RECIPES, type RecipeId } from '@/ai/generator/recipes';
import { getActiveProvider } from '@/ai/provider';
import { localModel } from '@/ai/providers/litert';
import { confirm, toast } from '@/capabilities';
import { describeSpec, omissions } from '@/runtime/describe';
import { Renderer } from '@/runtime/Renderer';
import { createSession } from '@/runtime/session';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { dataKey, removeKey, specKey, writeJson } from '@/storage';
import { notifyAppsChanged } from '@/storage/apps';
import { ActionButton } from '@/ui/ActionButton';
import { Card } from '@/ui/Card';
import { useAnnounce } from '@/ui/announce';
import { GenerationStages } from '@/ui/GenerationStages';
import { Icon } from '@/ui/Icon';
import { LocalModelCard } from '@/ui/LocalModelCard';
import { Reveal } from '@/ui/Reveal';
import { useInsets } from '@/ui/insets';
import { font, MIN_TARGET, pressed, radius, space, type, useTheme } from '@/ui/theme';
import { UnsupportedCard } from '@/ui/UnsupportedCard';

const EXAMPLES = [
  { label: 'Fridge Snap', prompt: "Take a photo of my fridge and make me a grocery list of what's running low" },
  { label: 'Plant Pal', prompt: 'Track which of my plants I watered and when, and remind me every Sunday morning' },
  { label: 'Bill Splitter', prompt: 'Photo of a restaurant bill → split it between friends' },
];

const SAVE_FAILED = 'Couldn’t save. Your changes are still open. Try again.';
const PROVIDER_NAMES = { local: 'On-device', ollama: 'Ollama', mock: 'Mock' } as const;

type Session = ReturnType<typeof createSession>;
type Draft = { id: string; spec: Spec; session: Session; notes: string[] };
type Phase =
  | { kind: 'idle' } | { kind: 'loading' } | { kind: 'needsModel' }
  | { kind: 'working'; progress: Pick<GenerationProgress, 'stage' | 'attempt' | 'freeForm' | 'freeFormReason'> }
  | ({ kind: 'preview' } & Draft)
  | { kind: 'unsupported'; unsupported: Unsupported }
  | { kind: 'choose'; choices: [RecipeId, RecipeId] }
  | { kind: 'failed'; message: string };

export default function Create() {
  const t = useTheme();
  const { bottom } = useInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const run = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const draft = useRef<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  useAnnounce(saveFailed ? SAVE_FAILED : null);
  // A tool type the user picked: the request is built as that type without guessing from its wording.
  const [picked, setPicked] = useState<RecipeId>();
  const [ready, setReady] = useState<{ id: string; name: string; ok: boolean } | null>(null);
  const [recheck, setRecheck] = useState(0);
  const [typesOpen, setTypesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Re-checked on every focus so coming back from Settings shows the new state; the typed prompt lives in this screen's state and survives the trip.
  useFocusEffect(useCallback(() => {
    let live = true;
    void getActiveProvider().then(async ({ provider }) => {
      const ok = await provider.isConfigured();
      if (!live) return;
      setReady({ id: provider.id, name: PROVIDER_NAMES[provider.id], ok });
      if (ok) setPhase((p) => (p.kind === 'needsModel' ? { kind: 'idle' } : p));
    });
    return () => { live = false; };
  }, [recheck]));

  // An unsaved preview must not leave its data behind.
  const discard = async () => {
    const d = draft.current;
    draft.current = null;
    if (!d) return;
    try {
      await d.session.store.flush().catch(() => {});
      await removeKey(dataKey(d.id));
      await removeKey(specKey(d.id)); // a half-saved draft must not linger as an app
    } catch (e) {
      console.warn('create: could not clean up the draft', e);
    }
  };
  useEffect(() => () => { abort.current?.abort(); void discard(); }, []);
  // Loading the on-device model takes ~20 s on a budget phone; do it while the user types the request.
  useEffect(() => {
    void getActiveProvider().then(async ({ provider }) => { if (provider.id === 'local') await localModel.warmUp(); });
  }, []);

  const build = async (text: string, recipe: RecipeId | undefined = picked) => {
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
      setPhase({ kind: 'working', progress: { stage: 'building', attempt: 0 } });
      const result = await generate({
        prompt: request, provider, model, signal: controller.signal,
        // PLAN costs a whole extra call and made E2B's FILL worse on the phone (ADR-025); FILL can refuse by itself.
        noPlan: true,
        // On-device a repair costs minutes, and a third full rewrite rarely succeeds on E2B.
        // Ready-made app types first; a request none of them fits is built freely by the same model (ADR-028, ADR-049).
        ...(provider.id === 'local' ? { maxRepairs: 1, recipes: true, askWhenUnsure: true } : {}),
        ...(recipe ? { recipe } : {}),
        onProgress: (e) => {
          if (live() && (e.stage === 'planning' || e.stage === 'building' || e.stage === 'checking' || e.stage === 'repairing')) {
            setPhase({ kind: 'working', progress: e });
          }
        },
      });
      if (!live()) return;
      if (result.status === 'choose') return setPhase({ kind: 'choose', choices: result.choices });
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
      // What the build could not do: lost settings from the recipe, plus things the request named that the spec lacks.
      const notes = [...(result.notes ?? []), ...omissions(request, result.spec)];
      const next = { id, spec: result.spec, session: createSession(id, result.spec, controller.signal), notes };
      draft.current = next;
      setPhase({ kind: 'preview', ...next });
    } catch (error) {
      console.error('create: unexpected failure', error);
      if (live()) setPhase({ kind: 'failed', message: 'Something went wrong. Try again.' });
    }
  };

  const cancel = () => { run.current++; abort.current?.abort(); setPhase({ kind: 'idle' }); };
  const save = async (d: Draft) => {
    if (saving) return;
    if (validate(d.spec).length) return toast("This mini-app can’t be saved.");
    setSaving(true);
    setSaveFailed(false);
    try {
      await writeJson(specKey(d.id), d.spec);
      await d.session.store.flush();
    } catch (e) {
      // Draft, preview and unsaved data stay as they are so Save can be tried again.
      console.error('create: save failed', e);
      setSaveFailed(true);
      setSaving(false);
      return;
    }
    setSaving(false);
    notifyAppsChanged();
    draft.current = null; // saved: the data now belongs to the mini-app
    disablePrevention(); // the preview is still on screen until replace() lands; saving must not ask to discard
    router.replace({ pathname: '/run/[id]', params: { id: d.id } });
  };

  const busy = phase.kind === 'loading' || phase.kind === 'working';

  // A build can take minutes on the phone, and leaving the preview deletes it (see `discard`) while leaving mid-build aborts it: ask before a stray Back does either.
  const disablePrevention = usePreventRemove(busy || phase.kind === 'preview', ({ repeat }) => {
    const [message, options] = phase.kind === 'preview'
      ? ['It hasn’t been saved. You can describe it again to build a new one.', { title: 'Discard this mini-app?', confirmLabel: 'Discard' }] as const
      : ['It isn’t ready yet. Leaving now cancels it, and you would start again.', { title: 'Stop building?', confirmLabel: 'Stop building' }] as const;
    void confirm(message, { ...options, destructive: true }).then((ok) => { if (ok) repeat(); });
  });

  if (phase.kind === 'preview') {
    return (
      <View style={[styles.fill, { backgroundColor: t.bg }]}>
        <View style={styles.column}>
          <View style={styles.banner}>
            <View style={[styles.pill, { backgroundColor: t.accentSoft }]}>
              <Text style={{ color: t.text, fontSize: type.meta, fontFamily: font.semibold }}>Preview · not saved yet</Text>
            </View>
            <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>{phase.spec.meta.icon} {phase.spec.meta.name}</Text>
          </View>
          <View accessibilityLiveRegion="polite" style={styles.about}>
            <Tap accessibilityRole="button" accessibilityLabel="Description" accessibilityState={{ expanded: aboutOpen }} accessibilityHint="What this mini-app does" onPress={() => setAboutOpen(!aboutOpen)}>
              <Text numberOfLines={aboutOpen ? undefined : 3} style={{ color: t.text, fontSize: type.hint }}>{describeSpec(phase.spec)}</Text>
            </Tap>
            {phase.notes.length ? (
              <View style={[styles.callout, { backgroundColor: t.surface, borderColor: t.outline }]}>
                <Icon name="information-circle-outline" size={22} color={t.text} />
                <Text style={[styles.flex, { color: t.text, fontSize: type.hint }]}>
                  <Text style={{ fontFamily: font.semibold }}>Good to know: </Text>{phase.notes.join(' ')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Reveal style={styles.fill}>
          <Renderer spec={phase.spec} store={phase.session.store} engine={phase.session.engine}
            onReady={(h) => phase.session.setNavigate(h.navigate)} />
        </Reveal>
        {saveFailed ? (
          <Text style={[styles.preview, styles.column, { color: t.text }]}>{SAVE_FAILED}</Text>
        ) : null}
        <View style={[styles.barWrap, { borderColor: t.border, backgroundColor: t.surface, paddingBottom: bottom }]}>
          <View style={styles.barInner}>
            <View style={styles.flex}><ActionButton kind="quiet" icon="refresh" label="Build again" onPress={() => void build(prompt)} /></View>
            <View style={styles.flex}><ActionButton icon="checkmark" label={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={() => void save(phase)} /></View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingBottom: space.lg + bottom }]} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={[styles.label, { color: t.text }]}>What should your mini-app do?</Text>
      <TextInput
        accessibilityLabel="Describe your mini-app" multiline editable={!busy} value={prompt} onChangeText={setPrompt}
        maxLength={1000} placeholder="e.g. Track my daily water intake" placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text, backgroundColor: t.surface, borderColor: t.outline }]}
      />
      <Text style={{ color: t.muted, fontSize: type.hint }}>Works best for a tracker, checklist, counter, calculator, timer, reminder, or photo-to-list tool.</Text>
      {busy ? <ActionButton kind="quiet" icon="close" label="Cancel" onPress={cancel} />
        : ready && !ready.ok ? (
          ready.id === 'local' ? (
            <>
              <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: type.hint }}>
                Building needs an AI model. Download it once and it stays on your phone.
              </Text>
              <LocalModelCard onDownloaded={() => setRecheck((n) => n + 1)} />
              <Tap accessibilityRole="button" onPress={() => router.navigate('/')} style={(st) => [styles.disclosure, pressed(st)]}>
                <Text style={{ color: t.accent, fontSize: type.hint, fontFamily: font.semibold }}>Meanwhile, try a ready-made tool</Text>
              </Tap>
            </>
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: type.hint }}>
                AI isn’t set up yet. Point JackApp at your own Ollama computer in Settings.
              </Text>
              <ActionButton icon="settings-outline" label="Set up AI" onPress={() => router.push('/settings')} />
            </>
          )
        )
        : <ActionButton icon="sparkles-outline" label="Build" disabled={!prompt.trim()} onPress={() => void build(prompt)} />}
      <Text style={[styles.sub, { color: t.text }]}>Need ideas?</Text>
      <View style={styles.chips}>
        {EXAMPLES.map((e) => (
          <Tap key={e.label} accessibilityRole="button" accessibilityLabel={`Example: ${e.label}`} disabled={busy}
            onPress={() => setPrompt(e.prompt)} style={(st) => [styles.chip, { backgroundColor: t.accentSoft }, pressed(st)]}>
            <Text style={{ color: t.text, fontSize: type.hint }}>{e.label}</Text>
          </Tap>
        ))}
      </View>
      <Tap accessibilityRole="button" accessibilityState={{ expanded: typesOpen }} disabled={busy} onPress={() => setTypesOpen(!typesOpen)}
        style={(st) => [styles.disclosure, pressed(st)]}>
        <Text style={{ color: t.text, fontSize: type.hint }}>{picked ? `Type: ${RECIPES[picked].title}` : 'Or pick a type of mini-app'}</Text>
        <Icon name={typesOpen ? 'chevron-up' : 'chevron-down'} size={20} color={t.text} />
      </Tap>
      {typesOpen ? (
        <View style={styles.chips}>
          {(Object.keys(RECIPES) as RecipeId[]).map((id) => (
            <Tap key={id} accessibilityRole="button" accessibilityLabel={`Type: ${RECIPES[id].title}`} accessibilityState={{ selected: picked === id }} disabled={busy}
              onPress={() => setPicked(picked === id ? undefined : id)}
              style={(st) => [styles.chip, { backgroundColor: picked === id ? t.accent : t.accentSoft }, pressed(st)]}>
              {picked === id ? <Icon name="checkmark" size={18} color={t.accentText} /> : null}
              <Text style={{ color: picked === id ? t.accentText : t.text, fontSize: type.hint }}>{RECIPES[id].title}</Text>
            </Tap>
          ))}
        </View>
      ) : null}

      {phase.kind === 'loading' ? (
        <View accessibilityLiveRegion="polite" style={styles.wait}>
          <ActivityIndicator color={t.accent} />
          <Text style={{ color: t.muted, fontSize: type.body }}>Getting ready…</Text>
        </View>
      ) : null}
      {phase.kind === 'working' ? <GenerationStages progress={phase.progress} /> : null}
      {phase.kind === 'needsModel' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Set up AI first</Text>
          <Text style={{ color: t.muted, fontSize: type.body }}>JackApp builds with a model on your phone (a one-time download of about 2.6 GB) or on your own Ollama computer.</Text>
          <ActionButton icon="settings-outline" label="Open settings" onPress={() => router.push('/settings')} />
        </Card>
      ) : null}
      {phase.kind === 'failed' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>That didn’t work</Text>
          <Text style={{ color: t.muted, fontSize: type.body }}>{phase.message}</Text>
          <ActionButton icon="refresh" label="Try again" onPress={() => void build(prompt)} />
        </Card>
      ) : null}
      {phase.kind === 'choose' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>
            {RECIPES[phase.choices[0]].title} or {RECIPES[phase.choices[1]].title}?
          </Text>
          <Text style={{ color: t.muted, fontSize: type.body }}>Your request could be either. Pick the one you want.</Text>
          {phase.choices.map((id) => (
            <ActionButton key={id} label={RECIPES[id].title} onPress={() => { setPicked(id); void build(prompt, id); }} />
          ))}
        </Card>
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
  label: { fontSize: 30, lineHeight: 36, fontFamily: font.display },
  sub: { fontSize: type.body, fontFamily: font.semibold },
  input: { minHeight: 140, padding: space.md, borderRadius: radius.control, borderWidth: 1, fontSize: 20, fontFamily: font.display, textAlignVertical: 'top' },
  disclosure: { minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wait: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: space.xs, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  h: { fontSize: type.h, fontFamily: font.display },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  preview: { fontSize: type.meta, paddingHorizontal: space.lg, paddingTop: space.sm },
  banner: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs, alignItems: 'flex-start' },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  about: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  callout: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.control, borderWidth: 1 },
  barWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  barInner: { flexDirection: 'row', gap: space.sm, padding: space.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
