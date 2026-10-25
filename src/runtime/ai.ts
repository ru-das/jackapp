import type { LLMProvider } from '@/ai/provider';
import { IsoDateSchema, StateDeclSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { FriendlyError, type ActionServices, type ResolvedAiStep } from './actions';
import type { Store } from './store';

export const AI_TIMEOUT_MS = 120_000;
const PROMPT_LIMIT = 2000;
const ATTEMPTS = 2;
const EMPTY_PHOTO = "Couldn't read anything in the photo. Try again with a closer, brighter photo.";
const EMPTY_TEXT = 'The AI gave an empty answer. Try again or add more detail.';

type FieldType = 'string' | 'number' | 'boolean' | 'date';
const ZERO: Record<FieldType, unknown> = { string: '', number: 0, boolean: false, date: null };
const JSON_TYPE: Record<FieldType, string> = { string: 'string', number: 'number', boolean: 'boolean', date: 'string' };

/** Same type vocabulary as state; a list field set is a subset of the target list's fields. */
function jsonSchema(output: ResolvedAiStep['output']) {
  const field = (t: FieldType) => ({ type: JSON_TYPE[t] });
  const root = (key: string, schema: object) => ({
    type: 'object', properties: { [key]: schema }, required: [key], additionalProperties: false,
  });
  if (output.type === 'list') {
    const keys = Object.keys(output.of);
    return { key: 'items', schema: root('items', { type: 'array', items: {
      type: 'object', properties: Object.fromEntries(keys.map((k) => [k, field(output.of[k] as FieldType)])),
      required: keys, additionalProperties: false,
    } }) };
  }
  if (output.type === 'image') throw new Error('ai.run cannot produce images.');
  return { key: 'value', schema: root('value', field(output.type)) };
}

/** undefined = does not fit; the caller falls back to defaults or zero values. */
function coerce(type: FieldType, v: unknown): unknown {
  switch (type) {
    case 'string': return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
    case 'number': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
    }
    case 'boolean': return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : undefined;
    case 'date': return IsoDateSchema.safeParse(v).success ? v : undefined;
  }
}

function parse(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in model output.');
  return JSON.parse(raw.slice(start, end + 1));
}

/** Unreadable = missing, wrong type, or a blank string; a blank name or price is not an answer. */
const read = (type: FieldType, v: unknown) => {
  const c = coerce(type, v);
  return typeof c === 'string' && c.trim() === '' ? undefined : c;
};

function interpret(step: ResolvedAiStep, target: Spec['state'][string], key: string, raw: string): unknown {
  const body = (parse(raw) as Record<string, unknown> | null)?.[key];
  if (step.output.type !== 'list') {
    const value = coerce(step.output.type as FieldType, body);
    if (value === undefined) throw new Error(`Model output "${key}" has the wrong type.`);
    if (step.output.type === 'string' && (value as string).trim() === '') throw new FriendlyError(EMPTY_TEXT);
    return value;
  }
  if (!Array.isArray(body) || target.type !== 'list') throw new Error('Model output "items" is not a list.');
  const of = step.output.of as Record<string, FieldType>;
  // A field is essential unless the spec gave it a default: a default says "safe to guess".
  const essential = Object.keys(of).filter((f) => !(step.defaults && f in step.defaults));
  const rows = body.flatMap((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error('A list row is not an object.');
    const cells = row as Record<string, unknown>;
    const missing = essential.filter((f) => read(of[f], cells[f]) === undefined);
    if (essential.length && missing.length === essential.length) return [];
    // Every target field is filled: model value, then defaults, then the type's zero value.
    const out: Record<string, unknown> = Object.fromEntries(Object.entries(target.of).map(([field, type]) => {
      const model = field in of ? coerce(type as FieldType, cells[field]) : undefined;
      const fallback = coerce(type as FieldType, step.defaults?.[field]);
      return [field, model ?? fallback ?? ZERO[type as FieldType]];
    }));
    if (step.flag) out[step.flag] = missing.length ? `Couldn't read the ${missing.join(' and ')}` : '';
    return [out];
  });
  if (!rows.length) throw new FriendlyError(step.image ? EMPTY_PHOTO : EMPTY_TEXT);
  return rows;
}

export interface AiServiceOptions {
  spec: Spec;
  store: Pick<Store, 'getState' | 'setState'>;
  /** Resolves the provider chosen in Settings (injected so tests use the mock). */
  getProvider(): Promise<{ provider: LLMProvider }>;
  signal?: AbortSignal;
}

/** The `ai.run` op: schema, one retry, coercion with defaults, 120 s timeout, abort. */
export function createAiService({ spec, store, getProvider, signal }: AiServiceOptions): NonNullable<ActionServices['ai']> {
  return async (step) => {
    // ADR-015: the engine already expanded the template with live state; this is the hard limit.
    if (step.prompt.length > PROMPT_LIMIT) throw new Error(`ai.run prompt is ${step.prompt.length} chars (max ${PROMPT_LIMIT}).`);
    const target = spec.state[step.into];
    if (!target) throw new Error(`Undeclared state: ${step.into}`);
    const image = step.image ?? null;
    if (image !== null && (typeof image !== 'string' || !image.startsWith('data:image/'))) {
      throw new Error('ai.run image must be a data:image URL.');
    }
    const { provider } = await getProvider();
    if (image && !provider.caps.vision) throw new Error('This model cannot read images.');
    if (!(await provider.isConfigured())) throw new Error('Set up AI in Settings.');

    const { key, schema } = jsonSchema(step.output);
    const system = `Reply with JSON only, no prose, matching this JSON Schema: ${JSON.stringify(schema)}`;
    const messages: Parameters<LLMProvider['generate']>[0]['messages'] = [
      { role: 'user', content: step.prompt, ...(image ? { images: [image] } : {}) },
    ];
    const abort = new AbortController();
    const onOuterAbort = () => abort.abort();
    signal?.addEventListener('abort', onOuterAbort);
    if (signal?.aborted) abort.abort();
    const timer = setTimeout(() => abort.abort(), AI_TIMEOUT_MS);
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const raw = await provider.generate({
          system, messages, signal: abort.signal, temperature: attempt ? 0 : 0.2, maxTokens: 1024, stage: 'run',
          ...(provider.caps.jsonSchema ? { jsonSchema: schema } : {}),
        });
        if (abort.signal.aborted) throw new Error('ai.run was cancelled or timed out.');
        try {
          const value = interpret(step, target, key, raw);
          const next = step.mode === 'append' && Array.isArray(value)
            ? [...(store.getState()[step.into] as unknown[]), ...value] : value;
          const checked = StateDeclSchema.safeParse({ ...target, default: next });
          if (!checked.success) throw new Error(`Invalid value for ${step.into}: ${checked.error.message}`);
          store.setState({ [step.into]: next });
          return;
        } catch (error) {
          lastError = error;
          console.warn(`ai.run attempt ${attempt + 1} rejected`, error);
          messages.push({ role: 'assistant', content: raw },
            { role: 'user', content: `That reply was not valid (${error instanceof Error ? error.message : 'unknown'}). Reply with JSON only matching the schema.` });
        }
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }
  };
}
