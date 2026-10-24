import { SpecSchema } from '@/spec/schema';
import type { Spec, SpecError } from '@/spec/types';
import { validate } from '@/spec/validate';
import { callStage, checkCancellation, fill, type StageRequest } from './fill';
import type { LLMProvider } from '../provider';
import { PlanSchema, UnsupportedSchema, type Plan, type TargetStage, type Unsupported } from './outputSchemas';
import { parseCompact, toCompact, toCompactSlice } from './compact';
import { schemaErrors, validatePlan } from './plan';
import { repair } from './repair';
import { generateRecipe } from './recipes/generateRecipe';

export type GenerationResult =
  | { status: 'done'; spec: Spec; repairs: number }
  | { status: 'unsupported'; unsupported: Unsupported; repairs: number }
  | { status: 'failed'; message: string; errors: SpecError[]; repairs: number };
export type GenerationProgress = {
  stage: 'planning' | 'building' | 'checking' | 'repairing' | GenerationResult['status'];
  target: TargetStage; attempt: number; errors?: SpecError[];
  /** Set when no ready-made app type fit and the request is being built freely, by the cloud model or on this device (slower, less reliable). */
  freeForm?: 'cloud' | 'device';
};
export type GenerateOptions = StageRequest & {
  model: string; noPlan?: boolean;
  /** Repair rounds before giving up (default 2). On-device each round costs minutes. */
  maxRepairs?: number;
  /** On-device path (ADR-027): refuse in code, pick a ready-made app type, let the model fill in its settings. */
  recipes?: boolean;
  /** Where free-form generation goes when no ready-made type fits (the cloud model, when the user set a key). Without it the same provider tries. */
  fallback?: { provider: LLMProvider; model: string };
  onProgress?: (event: GenerationProgress) => void;
};

export async function generate(options: GenerateOptions): Promise<GenerationResult> {
  if (options.recipes) {
    const outcome = await generateRecipe(options);
    if (outcome.status !== 'fallback') return outcome;
    const { fallback, ...rest } = options;
    const via = fallback ? 'cloud' : 'device';
    return generate({ ...rest, ...(fallback ?? {}), recipes: false, noPlan: true,
      onProgress: (event) => options.onProgress?.({ ...event, freeForm: via }) });
  }
  let repairs = 0;
  let target: TargetStage = options.noPlan ? 'spec' : 'plan';
  let errors: SpecError[] = [];
  const maxRepairs = options.maxRepairs ?? 2;
  // The latest usable spec draft: repairs return only changed lines, and these are merged into it.
  let draft: Record<string, unknown> | undefined;
  const emit = (stage: GenerationProgress['stage'], attempt = repairs, diagnostics?: SpecError[]) => {
    // An observer failure must not turn a terminal event into a second terminal event.
    try { options.onProgress?.({ stage, target, attempt,
      ...(diagnostics ? { errors: diagnostics.map((error) => ({ ...error })) } : {}) }); }
    catch (error) { console.warn('Generation progress listener failed', error); }
  };
  const finish = (result: GenerationResult) => { emit(result.status, repairs, result.status === 'failed' ? result.errors : undefined); return result; };
  try {
    checkCancellation(options.signal);
    emit(options.noPlan ? 'building' : 'planning');
    let raw = options.noPlan ? await fill(options)
      : await callStage({ ...options, stage: 'plan', target, content: `Request: ${options.prompt}` });
    let plan: Plan | undefined;
    for (;;) {
      checkCancellation(options.signal);
      emit('checking');
      checkCancellation(options.signal);
      const parsed = parseCompact(raw, target, draft);
      errors = parsed.errors;
      if (target === 'spec' && parsed.draft) draft = parsed.draft;
      if (parsed.value) {
        if (Object.hasOwn(parsed.value, 'unsupported') && !(target === 'plan' && parsed.value.unsupported === null)) {
          const refusal = UnsupportedSchema.safeParse(parsed.value);
          if (refusal.success) return finish({ status: 'unsupported', unsupported: refusal.data.unsupported, repairs });
          errors = schemaErrors(refusal.error);
        } else if (target === 'plan') {
          errors = validatePlan(parsed.value);
          if (!errors.length) plan = PlanSchema.parse(parsed.value);
        } else {
          const value = parsed.value;
          // Stamping before validation prevents spoofing and includes metadata in size limits.
          if (typeof value.meta === 'object' && value.meta !== null && !Array.isArray(value.meta)) {
            value.meta = { ...value.meta, sourcePrompt: options.prompt,
              generatedBy: { provider: options.provider.id, model: options.model } };
          }
          errors = validate(value);
          if (!errors.length) return finish({ status: 'done', spec: SpecSchema.parse(value), repairs });
        }
      }
      if (!errors.length && target === 'plan' && plan) {
        target = 'spec';
        draft = undefined;
        emit('building');
        raw = await fill({ ...options, plan });
        continue;
      }
      if (repairs >= maxRepairs) return finish({ status: 'failed', repairs, errors,
        message: 'I couldn’t build this mini-app. Try a simpler request.' });
      emit('repairing', repairs + 1, errors);
      // A spec repair sees only the lines the errors point at (a small model copies whatever it is shown), components with their #id so a patch can name them; the whole draft is the fallback. A refusal attempt is shown as written.
      const base = target === 'spec' ? draft : undefined;
      const refusal = /^\s*unsupported\b/m.test(raw);
      const lines = base && !refusal ? toCompactSlice(base, errors, raw) : undefined;
      raw = await repair({ ...options, target, errors, patch: base !== undefined, partial: lines !== undefined,
        raw: lines ?? (base && !refusal ? toCompact(base, true) : raw) });
      repairs++;
    }
  } catch (error) {
    const cancelled = options.signal?.aborted || (error instanceof Error && error.name === 'AbortError');
    return finish({ status: 'failed', repairs,
      message: cancelled ? 'Generation cancelled.' : 'The model couldn’t finish. Please try again.',
      errors: [{ code: 'SHAPE', path: target,
        message: error instanceof Error ? error.message : String(error),
        hint: cancelled ? 'Start again when ready.' : 'Check the loaded provider and try again.' }],
    });
  }
}
