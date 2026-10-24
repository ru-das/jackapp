import behaviourCorpus from '../../../evals/behaviour.json';
import corpus from '../../../evals/prompts.json';
import { createAiService } from '@/runtime/ai';
import type { LLMProvider } from '../provider';
import type { ActionStep, ComponentName, ErrorCode, Spec, SpecError } from '@/spec/types';
import { runChecks, type Check, type CheckResult } from './behaviour';
import { generate, type GenerationResult } from './generate';

export type EvalPrompt = {
  id: string; prompt: string; expect: 'spec' | 'unsupported';
  mustUse?: ComponentName[]; mustOps?: ActionStep['op'][];
  /** Scripted behaviour/intent checks (evals/behaviour.json only). */
  checks?: Check[];
};
export type EvalRow = EvalPrompt & {
  durationMs: number; result: GenerationResult; firstFillValid: boolean;
  missingRequirements: { components: ComponentName[]; ops: ActionStep['op'][] };
  checkResults: CheckResult[];
  diagnostics: { target: 'plan' | 'spec'; attempt: number; errors: SpecError[] }[];
};
/** Run settings the platform-free runner cannot see (backend, app revision, model load time); saved verbatim. */
export type EvalEnv = Record<string, string | number | boolean | null>;
export type EvalOptions = {
  /** `behaviour` is the hold-out set: never tune prompts or recipes against it. */
  corpus?: 'main' | 'behaviour'; env?: EvalEnv;
  noPlan?: boolean; maxRepairs?: number; recipes?: boolean; only?: string | readonly string[]; onResult?: (row: EvalRow) => void;
};

function ratio(count: number, denominator: number) {
  return { count, denominator, rate: denominator ? count / denominator : null };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor(sorted.length / 2)] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
};

function score(rows: EvalRow[], single: boolean) {
  const specs = rows.filter((row) => row.expect === 'spec');
  const valid = specs.filter((row) => row.result.status === 'done');
  const unsupported = rows.filter((row) => row.expect === 'unsupported');
  const refusals = rows.filter((row) => row.result.status === 'unsupported');
  const correct = unsupported.filter((row) => row.result.status === 'unsupported').length;
  const falseRefusals = specs.filter((row) => row.result.status === 'unsupported').length;
  const latencies = valid.map((row) => row.durationMs);
  const medianLatencyMs = median(latencies);
  const complete = (row: EvalRow) => !row.missingRequirements.components.length && !row.missingRequirements.ops.length;
  const layer = (name: Check['layer']) => {
    const checked = specs.filter((row) => row.checkResults.some((c) => c.layer === name));
    return ratio(checked.filter((row) => row.result.status === 'done'
      && row.checkResults.filter((c) => c.layer === name).every((c) => c.passed)).length, checked.length);
  };
  const metrics = {
    firstFillValidity: ratio(valid.filter((row) => row.firstFillValid).length, specs.length),
    validWithinTwoRepairs: ratio(valid.length, specs.length),
    requirementsSatisfied: ratio(valid.filter(complete).length, valid.length),
    correctRefusals: ratio(correct, unsupported.length),
    refusalRecall: ratio(correct, unsupported.length),
    refusalPrecision: ratio(correct, refusals.length),
    falseRefusals: ratio(falseRefusals, specs.length),
    medianLatencyMs, latencySamples: latencies.length,
    // Cold start is the first prompt of the run (it may include the model load); warm is every valid build after it.
    firstBuildMs: rows[0]?.result.status === 'done' ? rows[0].durationMs : null,
    warmMedianMs: median(valid.filter((row) => row !== rows[0]).map((row) => row.durationMs)),
    layers: {
      structure: ratio(valid.filter(complete).length, specs.length),
      behaviour: layer('behaviour'), intent: layer('intent'),
    },
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
  const prompts = ((options.corpus === 'behaviour' ? behaviourCorpus : corpus) as EvalPrompt[]).filter((prompt) => !ids || ids.includes(prompt.id));
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
    const durationMs = Date.now() - start;
    const checkResults = result.status === 'done' && prompt.checks ? await runChecks(result.spec, prompt.checks) : [];
    const row: EvalRow = { ...prompt, durationMs, result, checkResults,
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
    options: { corpus: options.corpus ?? 'main', noPlan: options.noPlan ?? false, maxRepairs: options.maxRepairs ?? null,
      recipes: options.recipes ?? false, only: options.only ?? null, env: options.env ?? {} }, rows,
    ...score(rows, options.only !== undefined) };
}

/** Photo `ai.run` latency on its own, so it never mixes with app-building time. Uses the real ai.run path with an in-memory store. */
export async function timePhoto(provider: LLMProvider, image: string, runs = 3) {
  // The service reads only `spec.state`.
  const spec = { state: { items: { type: 'list', of: { name: 'string' }, default: [], persist: true } } } as unknown as Spec;
  let state: Record<string, unknown> = { items: [] };
  const ai = createAiService({ spec, getProvider: async () => ({ provider }),
    store: { getState: () => state, setState: (next) => { state = { ...state, ...(typeof next === 'function' ? next(state) : next) }; } } });
  const durationsMs: number[] = [];
  try {
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      await ai({ op: 'ai.run', prompt: 'List the main objects you can see.', image, into: 'items', mode: 'replace',
        output: { type: 'list', of: { name: 'string' } } });
      durationsMs.push(Date.now() - start);
    }
    return { ok: true as const, durationsMs, medianMs: median(durationsMs), firstMs: durationsMs[0] };
  } catch (error) {
    return { ok: false as const, durationsMs, medianMs: median(durationsMs), firstMs: durationsMs[0] ?? null,
      error: error instanceof Error ? error.message : String(error) };
  }
}
