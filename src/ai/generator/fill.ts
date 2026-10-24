import type { LLMProvider } from '../provider';
import { outputSchema, type Plan, type TargetStage } from './outputSchemas';
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
  stage: 'plan' | 'fill' | 'repair'; target: TargetStage; content: string;
}) {
  const { provider, signal, stage, target, content } = options;
  checkCancellation(signal);
  const raw = await provider.generate({
    system: systemPrompt(stage, target), messages: [{ role: 'user', content }],
    // Only PLAN is schema-constrained: providers reject or choke on the 22 KB spec schema (ADR-017); the validator and repair loop guard the spec.
    ...(provider.caps.jsonSchema && target === 'plan' ? { jsonSchema: outputSchema(target) } : {}),
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
    content: JSON.stringify({ request: options.prompt, plan: options.plan }) });
}
