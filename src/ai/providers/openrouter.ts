import { loadSettings } from '@/storage/settings';
import { OPENROUTER_FALLBACKS, OPENROUTER_MODELS } from '../models';
import type { LLMProvider } from '../provider';

const URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRIES = 3;
const MAX_WAIT_MS = 20_000;
// max_tokens counts reasoning tokens. Nemotron spent all 1024 of the PLAN cap thinking and returned no text (effort: low is ignored), so callers' limits get this much extra.
const REASONING_HEADROOM = 6144;

const NEEDS_KEY = 'Add your OpenRouter key in Settings first.';
const BAD_KEY = 'OpenRouter did not accept your key. Check it in Settings.';
const BUSY = 'The free models are busy. Try again in a minute.';
const DAILY = "You've used today's free OpenRouter requests. They reset at midnight UTC, or add $10 of credits for 1000 a day.";
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
    models: [primary, ...OPENROUTER_FALLBACKS.filter((m) => m !== primary)],
    // Reasoning tokens count against max_tokens; unchecked they can use the whole PLAN cap and leave no text.
    reasoning: { effort: 'low' },
    messages: toMessages(req),
    ...(req.jsonSchema
      // json_object, not json_schema: Nvidia's grammar compiler rejects our Zod-derived schema (`propertyNames`). The prompt and validator enforce the shape.
      ? { response_format: { type: 'json_object' } }
      : {}),
    ...(req.maxTokens ? { max_tokens: req.maxTokens + REASONING_HEADROOM } : {}),
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
    if (res.status === 429) {
      const body: any = await res.json().catch(() => null); // JSON parse boundary
      const why: string = body?.error?.message ?? 'rate limited';
      req.onLog?.(`429 ${why}`);
      // The daily free quota only resets at midnight UTC, so retrying just burns time.
      if (/per.?day/i.test(why)) throw new Error(DAILY);
      if (attempt >= RETRIES) throw new Error(BUSY);
      const header = Number(res.headers.get('retry-after'));
      const wait = Math.min(MAX_WAIT_MS, header > 0 ? header * 1000 : 2000 * 2 ** attempt);
      req.onLog?.(`retry ${attempt + 1}/${RETRIES} in ${wait / 1000} s`);
      await sleep(wait, req.signal);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error(BAD_KEY);
    const json: any = await res.json().catch(() => null); // JSON parse boundary
    const text = json?.choices?.[0]?.message?.content;
    // Free upstreams sometimes time out with a 200 and an error body; one quick retry is usually enough.
    if ((res.status >= 500 || (json?.error && typeof text !== 'string')) && attempt < RETRIES) {
      req.onLog?.(`${res.status} ${json?.error?.message ?? 'upstream error'}, retry ${attempt + 1}/${RETRIES} in ${attempt + 1} s`);
      await sleep(1000 * (attempt + 1), req.signal);
      continue;
    }
    if (!res.ok || json?.error || typeof text !== 'string') {
      console.error('[openrouter] bad response', res.status, json?.error ?? json);
      // The detail lands in eval diagnostics; the screens show the generic generator message.
      const choice = json?.choices?.[0];
      const why = json?.error?.message ?? (choice ? `no text, finish_reason ${choice.finish_reason}` : 'no choices');
      throw new Error(`The AI service had a problem (${res.status}, ${json?.model ?? 'model unknown'}: ${why}). Please try again.`);
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
