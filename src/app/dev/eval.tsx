import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import corpus from '../../../evals/prompts.json';
import { QUICK_IDS, runEval, type EvalRow } from '@/ai/generator/eval';
import { getActiveProvider } from '@/ai/provider';
import { localModel } from '@/ai/providers/litert';
import { describeEvent, withLog, type CallEvent } from '@/ai/providers/logged';
import { saveFile, share, toast } from '@/capabilities';
import { EvalLog, SHOWN_LINES } from '@/ui/EvalLog';
import { LocalOptions } from '@/ui/LocalOptions';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

type Result = Awaited<ReturnType<typeof runEval>>;
type Ratio = { count: number; denominator: number; rate: number | null };
type Phase = 'idle' | 'loading' | 'running' | 'done' | 'needsModel';

const PROMPTS = corpus as { id: string; prompt: string }[];
const pct = (r: Ratio) => (r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`);
const mark = (met: boolean | null) => (met === null ? '—' : met ? '✓' : '✗');
const OUTPUT_MARK = '⎘ output:';
const stamp = () => new Date().toTimeString().slice(0, 8);
const rowMark = (row: EvalRow) => {
  const got = row.result.status;
  if (got === 'failed') return '✗';
  return (got === 'unsupported') === (row.expect === 'unsupported') ? '✓' : '⊘';
};

type Call = { stage: string; since: number; chars: number; firstTokenMs: number; note: string; repairs: number };
const IDLE: Call = { stage: '', since: 0, chars: 0, firstTokenMs: -1, note: '', repairs: 0 };

function liveStatus(c: Call, id: string, n: number, total: number, now: number) {
  const where = `${id} (${Math.min(n, total)}/${total})`;
  if (!c.stage) return `${where} · between calls`;
  const writing = (now - c.since - c.firstTokenMs) / 1000;
  const doing = c.chars
    ? `writing ${c.chars} chars (~${Math.round(c.chars / 4)} tokens${writing > 0 ? `, ~${(c.chars / 4 / writing).toFixed(1)} tok/s` : ''})`
    : c.note || 'waiting for the first token';
  return `${where} · ${c.stage.toUpperCase()}${c.repairs ? ` (repair ${c.repairs})` : ''} · ${doing} · ${Math.round((now - c.since) / 1000)} s in this call`;
}

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
  const [using, setUsing] = useState('');
  const [noPlan, setNoPlan] = useState(false);
  const [only, setOnly] = useState<string | readonly string[] | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [shown, setShown] = useState<string[]>([]);
  const started = useRef(0);
  const fullLog = useRef<string[]>([]);
  const order = useRef<string[]>([]);
  // Callbacks outlive the render that created them, so they count finished prompts here, not in `rows`.
  const doneCount = useRef(0);
  // The call in flight, as the provider wrapper reports it; read on each one-second tick.
  const call = useRef<Call>(IDLE);
  const [live, setLive] = useState('');
  const busy = phase === 'loading' || phase === 'running';
  const total = only === null ? PROMPTS.length : [only].flat().length;

  // `quiet` lines (full model output) go to the saved log and logcat but not onto the screen.
  const push = (line: string, quiet = false) => {
    const text = [stamp(), order.current[doneCount.current], line].filter(Boolean).join(' ');
    fullLog.current.push(text);
    console.log(`[eval] ${text}`);
    if (!quiet) setShown(fullLog.current.filter((l) => !l.includes(OUTPUT_MARK)).slice(-SHOWN_LINES));
  };
  const onEvent = (e: CallEvent) => {
    const c = call.current;
    if (e.kind === 'start') Object.assign(c, { stage: e.stage, since: Date.now(), chars: 0, firstTokenMs: -1, note: '', repairs: c.repairs + (e.stage === 'repair' ? 1 : 0) });
    if (e.kind === 'partial') {
      c.chars = e.chars;
      if (c.firstTokenMs >= 0) return;
      c.firstTokenMs = e.firstTokenMs;
      return push(`← first token after ${(e.firstTokenMs / 1000).toFixed(1)} s`);
    }
    if (e.kind === 'log') c.note = e.message;
    if (e.kind === 'done' || e.kind === 'error') c.stage = '';
    push(describeEvent(e));
    if (e.kind === 'done') push(`${OUTPUT_MARK} ${e.output}`, true);
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.round((now - started.current) / 1000));
      setLive(liveStatus(call.current, order.current[doneCount.current] ?? '', doneCount.current + 1, order.current.length, now));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    setError('');
    setRows([]);
    setResult(null);
    fullLog.current = [];
    doneCount.current = 0;
    setShown([]);
    call.current = { ...IDLE };
    setLive('');
    order.current = PROMPTS.filter((p) => only === null || [only].flat().includes(p.id)).map((p) => p.id);
    setPhase('loading');
    try {
      const { provider: base, model } = await getActiveProvider();
      const provider = withLog(base, onEvent);
      setUsing(`${base.label}${base.id === 'ollama' ? `: ${model}` : ''}`);
      if (!(await provider.isConfigured())) return setPhase('needsModel');
      started.current = Date.now();
      setElapsed(0);
      setPhase('running');
      const t = localModel.tuning;
      push(`Starting ${order.current.length} prompt(s) on ${base.label} (${model}), plan stage ${noPlan ? 'off' : 'on'}${base.id === 'local' ? `, ${t.backend.toUpperCase()}, speculative ${t.speculative ? 'on' : 'off'}, constrained JSON ${t.constrained ? 'on' : 'off'}` : ''}`);
      // shortcut: no cancel, runEval takes no signal; leave the screen or restart the app to stop, add a signal when needed
      const out = await runEval(provider, model, {
        noPlan, only: only ?? undefined,
        onResult: (row) => {
          push(`${rowMark(row)} ${row.result.status} after ${(row.durationMs / 1000).toFixed(1)} s, ${row.result.repairs} repair(s)${row.result.status === 'failed' ? `: ${row.result.message}` : ''}`);
          for (const d of row.diagnostics) for (const e of d.errors) push(`  ${d.target} attempt ${d.attempt}: ${e.code} ${e.path}: ${e.message}`);
          const missing = [...row.missingRequirements.components, ...row.missingRequirements.ops];
          if (missing.length) push(`  missing: ${missing.join(', ')}`);
          call.current.repairs = 0;
          doneCount.current++;
          setRows((prev) => [...prev, row]);
        },
      });
      push(`Finished in ${((Date.now() - started.current) / 1000).toFixed(1)} s`);
      setResult(out);
      setPhase('done');
    } catch (e) {
      console.error('eval: run failed', e);
      push(`✗ run stopped: ${e instanceof Error ? e.message : String(e)}`);
      setError('The run stopped early. Details are in the log.');
      setPhase('idle');
    }
  };

  const buildJson = () => JSON.stringify({ ...result, log: fullLog.current }, null, 2);
  const fileName = result
    ? `eval-${result.startedAt.replace(/[:.]/g, '-')}-${result.model}-${result.options.noPlan ? 'noplan' : 'plan'}.json`
    : '';
  const onShare = async () => {
    try { await share(buildJson()); } catch (e) { console.error('eval: share failed', e); toast('Could not share. Try Save file.'); }
  };
  const onSave = async () => {
    try {
      if (await saveFile(fileName, buildJson())) toast(`Saved ${fileName}`);
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
        <Text style={{ color: t.muted, fontSize: 15 }}>{using ? `Using ${using}.` : 'Uses the AI chosen in Settings.'}</Text>
        <View style={styles.switchRow}>
          <Text style={{ color: t.text, fontSize: 16, flex: 1 }}>Skip plan stage</Text>
          <Switch accessibilityLabel="Skip plan stage" value={noPlan} disabled={busy} onValueChange={setNoPlan} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null, label: `All ${PROMPTS.length}` }, { id: QUICK_IDS, label: `Quick ${QUICK_IDS.length}` }, ...PROMPTS.map((p) => ({ id: p.id, label: p.id }))].map((c) => {
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
        {typeof only === 'string' ? <Text style={{ color: t.muted, fontSize: 14 }}>{PROMPTS.find((p) => p.id === only)?.prompt}</Text> : null}
        <LocalOptions disabled={busy} />
        <Btn label={busy ? 'Running…' : 'Run'} onPress={() => void start()} disabled={busy} />
      </View>

      {phase === 'needsModel' ? (
        <View style={card}>
          <Text style={{ color: t.text, fontSize: 16 }}>Set up AI in Settings first, then come back.</Text>
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>{error}</Text> : null}

      {phase !== 'idle' && phase !== 'needsModel' ? (
        <View style={card} accessibilityLiveRegion="polite">
          <Text style={{ color: t.text, fontSize: 16 }}>
            {phase === 'loading' ? 'Starting…' : `${rows.length} / ${total} done${phase === 'running' ? ` · ${elapsed} s` : ''}`}
          </Text>
          {phase === 'running' && live ? <Text style={{ color: t.muted, fontSize: 14 }}>{live}</Text> : null}
          <View style={[styles.bar, { backgroundColor: t.accentSoft }]}>
            <View style={{ width: `${(rows.length / total) * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
          </View>
          {rows.map((row) => (
            <Text key={row.id} style={{ color: t.text, fontSize: 14 }}>
              {rowMark(row)} {row.id} · {row.result.status} · {row.result.repairs} repairs · {(row.durationMs / 1000).toFixed(1)} s
            </Text>
          ))}
          <EvalLog lines={shown} />
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
