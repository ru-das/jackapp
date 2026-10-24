import { loadSettings } from '@/storage/settings';
import { OPENROUTER_FALLBACK, OPENROUTER_MODELS } from '../models';
import type { LLMProvider } from '../provider';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRIES = 3;
const MAX_WAIT_MS = 20_000;

const NEEDS_KEY = 'Add your OpenRouter key in Settings first.';
const BAD_KEY = 'OpenRouter did not accept your key. Check it in Settings.';
const BUSY = 'The free models are busy. Try again in a minute.';
const OFFLINE = "Can't reach OpenRouter. Check your connection.";

type Req = Parameters<LLMProvider['generate']>[0];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(new Error('aborted')); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

function toMessages({ system, messages }: Req) {
  return [
    { role: 'system', content: system },
    ...messages.map((m) => ({
      role: m.role,
      content: m.images?.length
        ? [{ type: 'text', text: m.content }, ...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))]
        : m.content,
    })),
  ];
}

async function generate(req: Req): Promise<string> {
  const { openrouterKey } = await loadSettings();
  if (!openrouterKey.trim()) throw new Error(NEEDS_KEY);
  const primary = OPENROUTER_MODELS[req.stage ?? 'fill'];
  const body = JSON.stringify({
    models: [primary, OPENROUTER_FALLBACK],
    messages: toMessages(req),
    ...(req.jsonSchema
      ? { response_format: { type: 'json_schema', json_schema: { name: 'out', strict: true, schema: req.jsonSchema } } }
      : {}),
    ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
  });

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${openrouterKey.trim()}`, 'Content-Type': 'application/json', 'X-Title': 'JackApp' },
        body,
        signal: req.signal,
      });
    } catch (e) {
      if (req.signal?.aborted) throw new Error('aborted');
      console.error('[openrouter] request failed', e);
      throw new Error(OFFLINE);
    }
    if (res.status === 429 && attempt < RETRIES) {
      const header = Number(res.headers.get('retry-after'));
      await sleep(Math.min(MAX_WAIT_MS, header > 0 ? header * 1000 : 2000 * 2 ** attempt), req.signal);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error(BAD_KEY);
    if (res.status === 429) throw new Error(BUSY);
    const json: any = await res.json().catch(() => null); // JSON parse boundary
    const text = json?.choices?.[0]?.message?.content;
    if (!res.ok || json?.error || typeof text !== 'string') {
      console.error('[openrouter] bad response', res.status, json?.error ?? json);
      throw new Error('The AI service had a problem. Please try again.');
    }
    return text.trim();
  }
}

export const openrouterProvider: LLMProvider = {
  id: 'openrouter',
  label: 'OpenRouter (free models)',
  caps: { vision: true, jsonSchema: true, contextTokens: 32768 },
  isConfigured: async () => (await loadSettings()).openrouterKey.trim() !== '',
  generate,
};
