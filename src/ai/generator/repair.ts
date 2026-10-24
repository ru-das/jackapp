import type { SpecError } from '@/spec/types';
import { callStage, type StageRequest } from './fill';
import type { TargetStage } from './outputSchemas';

const describe = (e: SpecError) => `- ${e.code} at ${e.path || '(whole response)'}: ${e.message}${e.hint ? ` (${e.hint})` : ''}`;

/** `patch` means the model returns only the lines that change; plan repairs and drafts with nothing usable are rewritten whole. */
export function repair(options: StageRequest & { target: TargetStage; raw: string; errors: SpecError[]; patch?: boolean }) {
  // Only a response that was itself trying to refuse may be repaired into a refusal.
  return callStage({ ...options, stage: 'repair', allowRefusal: /^\s*unsupported\b/m.test(options.raw),
    content: `Request: ${options.prompt}\nPrevious response:\n${options.raw}\nErrors:\n${options.errors.map(describe).join('\n')}` });
}
