import { h1, h2, h3 } from '@/spec/fixtures';
import { toCompact, toCompactPlan, toCompactRefusal } from '../generator/compact';
import type { LLMProvider } from '../provider';

type Fixture = typeof h1 | typeof h2 | typeof h3;
const ROWS = ['Milk', 'Eggs', 'Butter'];

// Rules are the prompts' stage markers (generator/prompts.ts); no other test double sees the system text.
const pick = (text: string): Fixture =>
  /plant|water/.test(text) ? h2 : /bill|split|restaurant/.test(text) ? h3 : h1;

function planOf(spec: Fixture) {
  return {
    name: spec.meta.name, icon: spec.meta.icon, summary: spec.meta.description,
    state: Object.entries(spec.state).map(([key, d]) => ({
      key, type: d.type, ...('of' in d ? { of: d.of } : {}), purpose: key,
    })),
    screens: spec.screens.map((s: { id: string; title: string }) => ({ id: s.id, purpose: s.title })),
    components: Object.values(spec.elements).map((e) => ({ type: e.type, purpose: e.type })),
    actions: Object.entries(spec.actions).map(([id, a]) => ({
      id, purpose: id, ops: [...new Set(a.steps.map((s: { op: string }) => s.op))],
    })),
    triggers: 'triggers' in spec ? spec.triggers : [], unsupported: null,
  };
}

/** A value that satisfies a JSON Schema, with recognisable list rows for ai.run. */
function sample(schema: any, key = '', i = 0): unknown {
  switch (schema?.type) {
    case 'object':
      return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([k, s]) => [k, sample(s, k, i)]));
    case 'array': return ROWS.map((_, n) => sample(schema.items, key, n));
    case 'number': return 1;
    case 'boolean': return false;
    default: return key === 'name' ? ROWS[i] : 'Sample';
  }
}

export const mockProvider: LLMProvider = {
  id: 'mock',
  label: 'Mock',
  caps: { vision: true, jsonSchema: true, contextTokens: 4096 },
  isConfigured: async () => true,
  async generate({ system, messages, jsonSchema, signal }) {
    if (signal?.aborted) throw new Error('aborted');
    // Dev-only: lets the slow-model UI be walked through on web without a model (ADR-021).
    const delay = Number(process.env.EXPO_PUBLIC_MOCK_DELAY_MS) || 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (signal?.aborted) throw new Error('aborted');
    const text = (messages.at(-1)?.content ?? '').toLowerCase();
    const plan = system.includes('PLAN lines:');
    // FILL can refuse by itself now that PLAN is off by default (ADR-025).
    if ((plan || system.includes('FILL: build')) && /physics|simulat|3d game/.test(text)) {
      return toCompactRefusal({
        reason: 'Physics simulation needs a real-time drawing canvas and a physics engine.',
        missing: ['physics simulation', 'animated canvas'],
        suggestion: 'Build me a projectile calculator with inputs for angle and speed that shows range and height.',
      });
    }
    if (plan) return toCompactPlan(planOf(pick(text)));
    if (system.includes('FILL: build')) return toCompact(pick(text));
    return JSON.stringify(jsonSchema ? sample(jsonSchema) : { ok: true });
  },
};

/** Isolated scripts keep repair tests independent of the UI singleton. */
export function createScriptedMock(responses: readonly (string | Error)[]): LLMProvider {
  let next = 0;
  return {
    ...mockProvider,
    caps: { ...mockProvider.caps },
    async generate({ signal }) {
      if (signal?.aborted) throw new Error('aborted');
      if (next >= responses.length) throw new Error('Scripted mock exhausted.');
      const response = responses[next++];
      if (response instanceof Error) throw response;
      return response;
    },
  };
}
