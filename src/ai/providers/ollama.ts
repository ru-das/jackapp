import { loadSettings } from '@/storage/settings';
import { ProviderError } from '../errors';
import type { LLMProvider } from '../provider';

const NEEDS_MODEL = 'Add your Ollama model name in Settings first.';

// Ollama wants bare base64, not a data URL.
const bare = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

export const ollamaProvider: LLMProvider = {
  id: 'ollama',
  label: 'Ollama',
  caps: { vision: true, jsonSchema: true, contextTokens: 8192 },
  isConfigured: async () => (await loadSettings()).ollamaModel.trim() !== '',
  async generate(req) {
    const { ollamaUrl, ollamaModel } = await loadSettings();
    if (!ollamaModel.trim()) throw new ProviderError(NEEDS_MODEL);
    const base = ollamaUrl.replace(/\/+$/, '');
    let res: Response;
    try {
      res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel.trim(),
          stream: false,
          messages: [
            { role: 'system', content: req.system },
            ...req.messages.map((m) => ({
              role: m.role, content: m.content, ...(m.images?.length ? { images: m.images.map(bare) } : {}),
            })),
          ],
          ...(req.jsonSchema ? { format: req.jsonSchema } : {}),
          options: {
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            ...(req.maxTokens ? { num_predict: req.maxTokens } : {}),
          },
        }),
        signal: req.signal,
      });
    } catch (e) {
      if (req.signal?.aborted) throw new Error('aborted');
      console.error('[ollama] request failed', e);
      throw new ProviderError(`Can’t reach Ollama at ${base}. Is it running?`);
    }
    const json: any = await res.json().catch(() => null); // JSON parse boundary
    const text = json?.message?.content;
    if (!res.ok || typeof text !== 'string') {
      console.error('[ollama] bad response', res.status, json);
      throw new ProviderError(res.status === 404 ? `Ollama has no model called “${ollamaModel}”.` : 'Ollama had a problem. Try again.');
    }
    return text.trim();
  },
};

/** Asks the user's own Ollama which models it has, so Settings can say "works" or what to fix before a long build fails. */
export async function checkOllama(url: string, model: string): Promise<{ ok: boolean; message: string }> {
  const base = url.trim().replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/api/tags`);
  } catch (e) {
    console.error('[ollama] check failed', e);
    return { ok: false, message: `Can’t reach Ollama at ${base}. Is it running, and is the address right?` };
  }
  const json: any = await res.json().catch(() => null); // JSON parse boundary
  const names: unknown = json?.models;
  if (!res.ok || !Array.isArray(names)) return { ok: false, message: 'That address answered, but it doesn’t look like Ollama.' };
  const want = model.trim();
  const has = names.some((m: any) => typeof m?.name === 'string' && (m.name === want || m.name.startsWith(`${want}:`)));
  if (!want) return { ok: true, message: 'Ollama is running. Add a model name to finish.' };
  return has ? { ok: true, message: `Ollama is running and has “${want}”.` } : { ok: false, message: `Ollama is running but has no model called “${want}”. Check “ollama list”.` };
}
