import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import corpus from '../../../evals/prompts.json';
import { runEval, type EvalRow } from '@/ai/generator/eval';
import { MODELS, type ModelId } from '@/ai/models';
import { getProvider } from '@/ai/provider';
import { saveFile, share, toast } from '@/capabilities';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

type Result = Awaited<ReturnType<typeof runEval>>;
type Ratio = { count: number; denominator: number; rate: number | null };
type Phase = 'idle' | 'loading' | 'running' | 'done' | 'needsModel';

const PROMPTS = corpus as { id: string; prompt: string }[];
const pct = (r: Ratio) => (r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`);
const mark = (met: boolean | null) => (met === null ? '—' : met ? '✓' : '✗');
const rowMark = (row: EvalRow) => {
  const got = row.result.status;
  if (got === 'failed') return '✗';
  return (got === 'unsupported') === (row.expect === 'unsupported') ? '✓' : '⊘';
};

function Btn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={[styles.btn, { backgroundColor: t.accent, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: t.accentText, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function EvalScreen() {
  const t = useTheme();
  const [model, setModel] = useState<ModelId>('E2B');
  const [noPlan, setNoPlan] = useState(false);
  const [only, setOnly] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);
  const busy = phase === 'loading' || phase === 'running';
  const total = only ? 1 : PROMPTS.length;

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    setError('');
    setRows([]);
    setResult(null);
    setPhase('loading');
    try {
      const provider = getProvider('local');
      await provider.setModel(model);
      if (provider.status() !== 'ready') {
        if (!(await provider.isDownloaded())) return setPhase('needsModel');
        await provider.load();
      }
      started.current = Date.now();
      setElapsed(0);
      setPhase('running');
      // shortcut: no cancel, runEval takes no signal; leave the screen or restart the app to stop, add a signal when needed
      const out = await runEval(provider, model, {
        noPlan, only: only ?? undefined, onResult: (row) => setRows((prev) => [...prev, row]),
      });
      setResult(out);
      setPhase('done');
    } catch (e) {
      console.error('eval: run failed', e);
      setError('The run stopped early. Details are in the console.');
      setPhase('idle');
    }
  };

  const json = result ? JSON.stringify(result, null, 2) : '';
  const fileName = result
    ? `eval-${result.startedAt.replace(/[:.]/g, '-')}-${result.model}-${result.options.noPlan ? 'noplan' : 'plan'}.json`
    : '';
  const onShare = async () => {
    try { await share(json); } catch (e) { console.error('eval: share failed', e); toast('Could not share. Try Save file.'); }
  };
  const onSave = async () => {
    try {
      if (await saveFile(fileName, json)) toast(`Saved ${fileName}`);
    } catch (e) {
      console.error('eval: save failed', e);
      toast('Could not save the file.');
    }
  };

  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];
  const m = result?.metrics;
  const metricRows: { label: string; value: string; met: boolean | null }[] = result && m ? [
    { label: 'Valid on first fill', value: `${m.firstFillValidity.count}/${m.firstFillValidity.denominator} · ${pct(m.firstFillValidity)}`, met: result.targets.firstFillValidity.met },
    { label: 'Valid after repair', value: `${m.validWithinTwoRepairs.count}/${m.validWithinTwoRepairs.denominator} · ${pct(m.validWithinTwoRepairs)}`, met: result.targets.validWithinTwoRepairs.met },
    { label: 'Requirements met', value: `${m.requirementsSatisfied.count}/${m.requirementsSatisfied.denominator} · ${pct(m.requirementsSatisfied)}`, met: result.targets.requirementsSatisfied.met },
    { label: 'Correct refusals', value: `${m.correctRefusals.count}/${m.correctRefusals.denominator} · ${pct(m.correctRefusals)}`, met: result.targets.correctRefusals.met },
    { label: 'Refusal precision', value: `${m.refusalPrecision.count}/${m.refusalPrecision.denominator} · ${pct(m.refusalPrecision)}`, met: null },
    { label: 'False refusals', value: `${m.falseRefusals.count}/${m.falseRefusals.denominator} · ${pct(m.falseRefusals)}`, met: result.targets.falseRefusals.met },
    { label: 'Median latency', value: m.medianLatencyMs === null ? '—' : `${(m.medianLatencyMs / 1000).toFixed(1)} s (n=${m.latencySamples})`, met: result.targets.medianLatencyMs.met },
  ] : [];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Eval (dev)</Text>
        {(Object.keys(MODELS) as ModelId[]).map((id) => {
          const on = model === id;
          return (
            <Pressable
              key={id} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: busy }}
              accessibilityLabel={MODELS[id].label} disabled={busy} onPress={() => setModel(id)}
              style={[styles.row, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.border }]}
            >
              <Text style={{ color: t.text, fontSize: 16 }}>{MODELS[id].label}</Text>
            </Pressable>
          );
        })}
        <View style={styles.switchRow}>
          <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>Skip plan stage</Text>
          <Switch accessibilityLabel="Skip plan stage" value={noPlan} disabled={busy} onValueChange={setNoPlan} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null, label: `All ${PROMPTS.length}` }, ...PROMPTS.map((p) => ({ id: p.id, label: p.id }))].map((c) => {
            const on = only === c.id;
            return (
              <Pressable
                key={c.label} accessibilityRole="radio" accessibilityLabel={`Prompt ${c.label}`}
                accessibilityState={{ selected: on, disabled: busy }} disabled={busy} onPress={() => setOnly(c.id)}
                style={[styles.chip, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.border }]}
              >
                <Text style={{ color: t.text, fontSize: 15 }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {only ? <Text style={{ color: t.muted, fontSize: 14 }}>{PROMPTS.find((p) => p.id === only)?.prompt}</Text> : null}
        <Btn label={busy ? 'Running…' : 'Run'} onPress={() => void start()} disabled={busy} />
      </View>

      {phase === 'needsModel' ? (
        <View style={card}>
          <Text style={{ color: t.text, fontSize: 16 }}>Download {MODELS[model].label} in Settings first, then come back.</Text>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>{error}</Text> : null}

      {phase !== 'idle' && phase !== 'needsModel' ? (
        <View style={card} accessibilityLiveRegion="polite">
          <Text style={{ color: t.text, fontSize: 16 }}>
            {phase === 'loading' ? 'Loading model…' : `${rows.length} / ${total} done${phase === 'running' ? ` · ${elapsed} s` : ''}`}
          </Text>
          <View style={[styles.bar, { backgroundColor: t.accentSoft }]}>
            <View style={{ width: `${(rows.length / total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
          </View>
          {rows.map((row) => (
            <Text key={row.id} style={{ color: t.text, fontSize: 14 }}>
              {rowMark(row)} {row.id} · {row.result.status} · {row.result.repairs} repairs · {(row.durationMs / 1000).toFixed(1)} s
            </Text>
          ))}
        </View>
      ) : null}

      {result ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Results</Text>
          {metricRows.map((r) => (
            <View key={r.label} style={styles.metric}>
              <Text style={{ color: t.text, fontSize: 15, flex: 1 }}>{r.label}</Text>
              <Text style={{ color: t.text, fontSize: 15 }}>{r.value} {mark(r.met)}</Text>
            </View>
          ))}
          {result.topErrors.length ? (
            <>
              <Text style={{ color: t.muted, fontSize: 14 }}>Top errors</Text>
              {result.topErrors.map((e) => (
                <Text key={e.code} style={{ color: t.text, fontSize: 14 }}>{e.code} × {e.count}</Text>
              ))}
            </>
          ) : null}
          <Btn label="Share" onPress={() => void onShare()} />
          <Btn label="Save file" onPress={() => void onSave()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.card, padding: space.md, gap: space.sm },
  h: { fontSize: 20, fontWeight: '700' },
  row: { minHeight: MIN_TARGET, justifyContent: 'center', borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TARGET },
  chips: { gap: space.sm },
  chip: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md },
  btn: { minHeight: MIN_TARGET, justifyContent: 'center', alignItems: 'center', borderRadius: radius.control, paddingHorizontal: space.md },
  bar: { height: 8, borderRadius: 4 },
  metric: { flexDirection: 'row', gap: space.sm, minHeight: 28, alignItems: 'center' },
});
