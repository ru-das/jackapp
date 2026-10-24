import { describeEvent, withLog, type CallEvent } from '@/ai/providers/logged';
import type { LLMProvider } from '@/ai/provider';

const base = (generate: LLMProvider['generate']): LLMProvider =>
  ({ id: 'mock', label: 'x', caps: { vision: false, jsonSchema: false, contextTokens: 1 }, isConfigured: async () => true, generate });

test('reports start, first token, provider notes and done, in order, and forwards the result', async () => {
  const events: CallEvent[] = [];
  const wrapped = withLog(base(async (req) => {
    req.onLog?.('GPU: model load 0 ms');
    req.onPartial?.(10);
    req.onPartial?.(40);
    return ' {"a":   1}\n ';
  }), (e) => events.push(e));
  const out = await wrapped.generate({ system: 'sys', stage: 'repair', messages: [{ role: 'user', content: 'hello', images: ['data:image/png;base64,AA'] }] });
  expect(out).toBe(' {"a":   1}\n ');
  expect(events.map((e) => e.kind)).toEqual(['start', 'log', 'partial', 'partial', 'done']);
  expect(events[0]).toEqual({ kind: 'start', stage: 'repair', systemChars: 3, promptChars: 5, images: 1 });
  const partials = events.filter((e) => e.kind === 'partial');
  expect(partials[0]).toMatchObject({ chars: 10 });
  expect(partials[1]).toMatchObject({ chars: 40, firstTokenMs: (partials[0] as { firstTokenMs: number }).firstTokenMs });
  expect(events[4]).toMatchObject({ kind: 'done', chars: 13, preview: ' {"a": 1} ' });
});

test('an error is reported and rethrown', async () => {
  const events: CallEvent[] = [];
  const wrapped = withLog(base(async () => { throw new Error('boom'); }), (e) => events.push(e));
  await expect(wrapped.generate({ system: '', messages: [] })).rejects.toThrow('boom');
  expect(events.map((e) => e.kind)).toEqual(['start', 'error']);
  expect(describeEvent(events[1])).toMatch(/^✗ failed after \d\.\d s: boom$/);
});

test('callers still receive their own onPartial and onLog', async () => {
  const seen: string[] = [];
  const wrapped = withLog(base(async (req) => { req.onLog?.('note'); req.onPartial?.(3); return 'ok'; }), () => {});
  await wrapped.generate({ system: '', messages: [], onLog: (m) => seen.push(m), onPartial: (n) => seen.push(String(n)) });
  expect(seen).toEqual(['note', '3']);
});

test('lines read like a log', () => {
  expect(describeEvent({ kind: 'start', stage: 'plan', systemChars: 5889, promptChars: 96, images: 0 })).toBe('→ PLAN: 5889 system chars, 96 prompt chars');
  expect(describeEvent({ kind: 'log', message: '429 busy' })).toBe('  429 busy');
});
