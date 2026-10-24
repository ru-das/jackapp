import { loadSettings } from '@/storage/settings';
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
    if (!ollamaModel.trim()) throw new Error(NEEDS_MODEL);
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
      throw new Error(`Can't reach Ollama at ${base}. Is it running?`);
    }
    const json: any = await res.json().catch(() => null); // JSON parse boundary
    const text = json?.message?.content;
    if (!res.ok || typeof text !== 'string') {
      console.error('[ollama] bad response', res.status, json);
      throw new Error(res.status === 404 ? `Ollama has no model called "${ollamaModel}".` : 'Ollama had a problem. Please try again.');
    }
    return text.trim();
  },
};
