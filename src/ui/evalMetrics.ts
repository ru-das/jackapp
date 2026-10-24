import type { runEval } from '@/ai/generator/eval';

type Result = Awaited<ReturnType<typeof runEval>>;
type Ratio = { count: number; denominator: number; rate: number | null };

const pct = (r: Ratio) => (r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`);
const frac = (r: Ratio) => `${r.count}/${r.denominator} · ${pct(r)}`;
const secs = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);

/** Rows of the results card: label, value, and whether the T-60 target was met (null = no target). */
export function metricRows(result: Result): { label: string; value: string; met: boolean | null }[] {
  const m = result.metrics;
  const t = result.targets;
  return [
    { label: 'Structure (valid, requirements met)', value: frac(m.layers.structure), met: null },
    { label: 'Behaviour (workflow works)', value: frac(m.layers.behaviour), met: null },
    { label: 'Intent (does what was asked)', value: frac(m.layers.intent), met: null },
    { label: 'Valid on first fill', value: frac(m.firstFillValidity), met: t.firstFillValidity.met },
    { label: 'Valid after repair', value: frac(m.validWithinTwoRepairs), met: t.validWithinTwoRepairs.met },
    { label: 'Requirements met', value: frac(m.requirementsSatisfied), met: t.requirementsSatisfied.met },
    { label: 'Correct refusals', value: frac(m.correctRefusals), met: t.correctRefusals.met },
    { label: 'Refusal precision', value: frac(m.refusalPrecision), met: null },
    { label: 'False refusals', value: frac(m.falseRefusals), met: t.falseRefusals.met },
    { label: 'Median build', value: `${secs(m.medianLatencyMs)} (n=${m.latencySamples})`, met: t.medianLatencyMs.met },
    { label: 'Cold build (first prompt)', value: secs(m.firstBuildMs), met: null },
    { label: 'Warm median (after first)', value: secs(m.warmMedianMs), met: null },
  ];
}
