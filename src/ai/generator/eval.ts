import corpus from '../../../evals/prompts.json';
import type { LLMProvider } from '../provider';
import type { ActionStep, ComponentName, ErrorCode, SpecError } from '@/spec/types';
import { generate, type GenerationResult } from './generate';

export type EvalPrompt = {
  id: string; prompt: string; expect: 'spec' | 'unsupported';
  mustUse?: ComponentName[]; mustOps?: ActionStep['op'][];
};
export type EvalRow = EvalPrompt & {
  durationMs: number; result: GenerationResult; firstFillValid: boolean;
  missingRequirements: { components: ComponentName[]; ops: ActionStep['op'][] };
  diagnostics: { target: 'plan' | 'spec'; attempt: number; errors: SpecError[] }[];
};
export type EvalOptions = {
  noPlan?: boolean; maxRepairs?: number; recipes?: boolean; only?: string | readonly string[]; onResult?: (row: EvalRow) => void;
};

function ratio(count: number, denominator: number) {
  return { count, denominator, rate: denominator ? count / denominator : null };
}

function score(rows: EvalRow[], single: boolean) {
  const specs = rows.filter((row) => row.expect === 'spec');
  const valid = specs.filter((row) => row.result.status === 'done');
  const unsupported = rows.filter((row) => row.expect === 'unsupported');
  const refusals = rows.filter((row) => row.result.status === 'unsupported');
  const correct = unsupported.filter((row) => row.result.status === 'unsupported').length;
  const falseRefusals = specs.filter((row) => row.result.status === 'unsupported').length;
  const latencies = valid.map((row) => row.durationMs).sort((a, b) => a - b);
  const middle = Math.floor(latencies.length / 2);
  const medianLatencyMs = latencies.length
    ? (latencies[middle] + latencies[Math.floor((latencies.length - 1) / 2)]) / 2 : null;
  const metrics = {
    firstFillValidity: ratio(valid.filter((row) => row.firstFillValid).length, specs.length),
    validWithinTwoRepairs: ratio(valid.length, specs.length),
    requirementsSatisfied: ratio(valid.filter((row) =>
      !row.missingRequirements.components.length && !row.missingRequirements.ops.length).length, valid.length),
    correctRefusals: ratio(correct, unsupported.length),
    refusalRecall: ratio(correct, unsupported.length),
    refusalPrecision: ratio(correct, refusals.length),
    falseRefusals: ratio(falseRefusals, specs.length),
    medianLatencyMs, latencySamples: latencies.length,
  };
  const atLeast = (value: number | null, target: number) => single || value === null ? null : value >= target;
  const targets = {
    firstFillValidity: { minimumRate: 0.5, met: atLeast(metrics.firstFillValidity.rate, 0.5) },
    validWithinTwoRepairs: { minimumRate: 0.8, met: atLeast(metrics.validWithinTwoRepairs.rate, 0.8) },
    requirementsSatisfied: { minimumRate: 0.8, met: atLeast(metrics.requirementsSatisfied.rate, 0.8) },
    correctRefusals: { minimumCount: 4, denominator: 5, met: single ? null : correct >= 4 },
    falseRefusals: { maximumCount: 2, denominator: 25, met: single ? null : falseRefusals <= 2 },
    medianLatencyMs: { maximumMs: 90_000,
      met: single || medianLatencyMs === null ? null : medianLatencyMs <= 90_000 },
  };
  const counts = new Map<ErrorCode, number>();
  for (const row of rows) for (const diagnostic of row.diagnostics) for (const error of diagnostic.errors) {
    counts.set(error.code, (counts.get(error.code) ?? 0) + 1);
  }
  const topErrors = [...counts].map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)).slice(0, 5);
  return { metrics, targets, topErrors };
}

/** `only` is one id or a list (e.g. QUICK_IDS); any subset is a partial run. The caller selects and loads the provider. This runner only performs inference. */
/** One of each kind: fridge, plant, bill, expenses, plus two refusals. Fits the OpenRouter free daily limit. */
export const QUICK_IDS = ['e01', 'e05', 'e09', 'e13', 'e26', 'e29'] as const;

export async function runEval(provider: LLMProvider, model: string, options: EvalOptions = {}) {
  const ids = options.only === undefined ? undefined : [options.only].flat();
  const prompts = (corpus as EvalPrompt[]).filter((prompt) => !ids || ids.includes(prompt.id));
  if (!prompts.length || (ids && prompts.length < new Set(ids).size)) throw new Error(`Unknown eval prompt id: ${ids}`);
  const startedAt = new Date().toISOString();
  const rows: EvalRow[] = [];
  for (const prompt of prompts) {
    const start = Date.now();
    const diagnostics: EvalRow['diagnostics'] = [];
    let specRepair = false;
    const result = await generate({ provider, model, prompt: prompt.prompt, noPlan: options.noPlan, maxRepairs: options.maxRepairs, recipes: options.recipes,
      onProgress: (event) => {
        if (event.stage === 'repairing' && event.target === 'spec') specRepair = true;
        if (event.errors) diagnostics.push({ target: event.target, attempt: event.attempt,
          errors: event.errors.map((error) => ({ ...error })) });
      },
    });
    const components = result.status === 'done' ? Object.values(result.spec.elements).map((element) => element.type) : [];
    const ops = result.status === 'done' ? Object.values(result.spec.actions).flatMap((action) => action.steps.map((step) => step.op)) : [];
    const row: EvalRow = { ...prompt, durationMs: Date.now() - start, result,
      firstFillValid: result.status === 'done' && !specRepair,
      missingRequirements: {
        components: (prompt.mustUse ?? []).filter((name) => !components.includes(name)),
        ops: (prompt.mustOps ?? []).filter((op) => !ops.includes(op)),
      }, diagnostics };
    rows.push(row);
    // UI observers cannot truncate a suite or mutate its saved results.
    try { options.onResult?.(JSON.parse(JSON.stringify(row)) as EvalRow); }
    catch (error) { console.warn('Eval result listener failed', error); }
  }
  return { startedAt, finishedAt: new Date().toISOString(), provider: provider.id, model,
    options: { noPlan: options.noPlan ?? false, only: options.only ?? null }, rows,
    ...score(rows, options.only !== undefined) };
}
