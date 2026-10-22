import type { SpecError } from '@/spec/types';
import { callStage, type StageRequest } from './fill';
import type { TargetStage } from './outputSchemas';

export function repair(options: StageRequest & { target: TargetStage; raw: string; errors: SpecError[] }) {
  return callStage({ ...options, stage: 'repair', content: JSON.stringify({
    request: options.prompt, target: options.target, previousResponse: options.raw, errors: options.errors,
  }) });
}
