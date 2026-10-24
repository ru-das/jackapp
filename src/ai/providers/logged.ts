import type { LLMProvider } from '../provider';

export type CallEvent =
  | { kind: 'start'; stage: string; systemChars: number; promptChars: number; images: number }
  | { kind: 'partial'; chars: number; ms: number; firstTokenMs: number }
  | { kind: 'log'; message: string }
  | { kind: 'done'; ms: number; chars: number; preview: string; output: string }
  | { kind: 'error'; ms: number; message: string };

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** One log line per event, for the eval screen, the saved JSON and `adb logcat`. */
export function describeEvent(e: CallEvent): string {
  switch (e.kind) {
    case 'start': return `→ ${e.stage.toUpperCase()}: ${e.systemChars} system chars, ${e.promptChars} prompt chars${e.images ? `, ${e.images} image` : ''}`;
    case 'partial': return `… ${e.chars} chars so far`;
    case 'log': return `  ${e.message}`;
    case 'done': return `✓ ${e.chars} chars in ${secs(e.ms)}: ${e.preview}`;
    case 'error': return `✗ failed after ${secs(e.ms)}: ${e.message}`;
  }
}

/** Reports every call a provider makes. Streaming providers also report partial output; the first partial marks the first token. */
export function withLog(provider: LLMProvider, emit: (e: CallEvent) => void): LLMProvider {
  return {
    ...provider,
    async generate(req) {
      const started = Date.now();
      let firstTokenMs = -1;
      emit({
        kind: 'start', stage: req.stage ?? 'fill', systemChars: req.system.length,
        promptChars: req.messages.reduce((n, m) => n + m.content.length, 0),
        images: req.messages.reduce((n, m) => n + (m.images?.length ?? 0), 0),
      });
      try {
        const text = await provider.generate({
          ...req,
          onPartial: (chars) => {
            const ms = Date.now() - started;
            if (firstTokenMs < 0) firstTokenMs = ms;
            emit({ kind: 'partial', chars, ms, firstTokenMs });
            req.onPartial?.(chars);
          },
          onLog: (message) => { emit({ kind: 'log', message }); req.onLog?.(message); },
        });
        emit({ kind: 'done', ms: Date.now() - started, chars: text.length, preview: text.slice(0, 100).replace(/\s+/g, ' '), output: text });
        return text;
      } catch (error) {
        emit({ kind: 'error', ms: Date.now() - started, message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
  };
}
