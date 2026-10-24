import type { LLMProvider } from '../provider';
import { toCompactPlan } from './compact';
import type { Plan, TargetStage } from './outputSchemas';
import { systemPrompt } from './prompts';

export type StageRequest = { prompt: string; provider: LLMProvider; signal?: AbortSignal };

export function checkCancellation(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Generation cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

export async function callStage(options: StageRequest & {
  stage: 'plan' | 'fill' | 'repair'; target: TargetStage; content: string; allowRefusal?: boolean; patch?: boolean;
}) {
  const { provider, signal, stage, target, content, allowRefusal, patch } = options;
  checkCancellation(signal);
  const raw = await provider.generate({
    system: systemPrompt(stage, target, allowRefusal, patch), messages: [{ role: 'user', content }],
    // No JSON Schema and no JSON-only decoding: the model writes the line format (ADR-023), and the validator guards the spec.
    plainText: true,
    stage,
    maxTokens: target === 'plan' ? 1024 : 4096,
    temperature: stage === 'repair' ? 0.1 : stage === 'plan' ? 0.4 : 0.2,
    ...(signal ? { signal } : {}),
  });
  checkCancellation(signal);
  return raw;
}

export function fill(options: StageRequest & { plan?: Plan }) {
  return callStage({ ...options, stage: 'fill', target: 'spec',
    content: `Request: ${options.prompt}${options.plan ? `\nPlan:\n${toCompactPlan(options.plan)}` : ''}` });
}
