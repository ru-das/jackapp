import { getActiveProvider } from '@/ai/provider';
import { confirm, share, toast } from '@/capabilities';
import type { Spec } from '@/spec/types';
import { createActionEngine } from './actions';
import { createAiService } from './ai';
import type { RendererHandle } from './Renderer';
import { createStore } from './store';

type Navigate = RendererHandle['navigate'];

/** Store + engine + capability services for one open mini-app (run screen and create preview). */
export function createSession(id: string, spec: Spec, signal?: AbortSignal) {
  let navigate: Navigate | undefined;
  const store = createStore(id, spec.state);
  const engine = createActionEngine({
    spec, store,
    services: {
      share, toast, confirm, navigate: (to) => navigate?.(to),
      ai: createAiService({ spec, store, getProvider: getActiveProvider, signal }),
    },
    getValueContext: () => ({
      now: new Date(), locale: Intl.DateTimeFormat().resolvedOptions().locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'USD', // shortcut: same fixed currency as Renderer, until a currency setting exists
      onWarning: (m) => console.warn(`spec: ${m}`),
    }),
  });
  return { store, engine, setNavigate: (fn: Navigate | undefined) => { navigate = fn; } };
}
