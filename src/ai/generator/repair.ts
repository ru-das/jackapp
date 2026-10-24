import type { SpecError } from '@/spec/types';
import { callStage, type StageRequest } from './fill';
import type { TargetStage } from './outputSchemas';

export function repair(options: StageRequest & { target: TargetStage; raw: string; errors: SpecError[] }) {
  // Only a response that was itself trying to refuse may be repaired into a refusal.
  return callStage({ ...options, stage: 'repair', allowRefusal: options.raw.includes('"unsupported"'), content: JSON.stringify({
    request: options.prompt, target: options.target, previousResponse: options.raw, errors: options.errors,
  }) });
}
