import { SpecSchema } from '@/spec/schema';
import type { Spec, SpecError } from '@/spec/types';
import { validate } from '@/spec/validate';
import { callStage, checkCancellation, fill, type StageRequest } from './fill';
import { PlanSchema, UnsupportedSchema, type Plan, type TargetStage, type Unsupported } from './outputSchemas';
import { parseResponse } from './parse';
import { schemaErrors, validatePlan } from './plan';
import { repair } from './repair';

export type GenerationResult =
  | { status: 'done'; spec: Spec; repairs: number }
  | { status: 'unsupported'; unsupported: Unsupported; repairs: number }
  | { status: 'failed'; message: string; errors: SpecError[]; repairs: number };
export type GenerationProgress = {
  stage: 'planning' | 'building' | 'checking' | 'repairing' | GenerationResult['status'];
  target: TargetStage; attempt: number;
};
export type GenerateOptions = StageRequest & {
  model: string; onProgress?: (event: GenerationProgress) => void;
};

export async function generate(options: GenerateOptions): Promise<GenerationResult> {
  let repairs = 0;
  let target: TargetStage = 'plan';
  let errors: SpecError[] = [];
  const emit = (stage: GenerationProgress['stage'], attempt = repairs) => {
    // An observer failure must not turn a terminal event into a second terminal event.
    try { options.onProgress?.({ stage, target, attempt }); }
    catch (error) { console.warn('Generation progress listener failed', error); }
  };
  const finish = (result: GenerationResult) => { emit(result.status); return result; };
  try {
    checkCancellation(options.signal);
    emit('planning');
    let raw = await callStage({ ...options, stage: 'plan', target, content: JSON.stringify({ request: options.prompt }) });
    let plan: Plan | undefined;
    for (;;) {
      checkCancellation(options.signal);
      emit('checking');
      checkCancellation(options.signal);
      const parsed = parseResponse(raw);
      errors = parsed.errors;
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
        emit('building');
        raw = await fill({ ...options, plan });
        continue;
      }
      if (repairs === 2) return finish({ status: 'failed', repairs, errors,
        message: 'I couldn’t build this mini-app. Try a simpler request.' });
      emit('repairing', repairs + 1);
      raw = await repair({ ...options, target, raw, errors });
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
