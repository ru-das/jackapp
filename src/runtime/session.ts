import { getActiveProvider } from '@/ai/provider';
import { confirm, notifyNow, share, toast } from '@/capabilities';
import type { Spec } from '@/spec/types';
import { preferredCurrency } from '@/storage/settings';
import { createActionEngine } from './actions';
import { createAiService } from './ai';
import type { RendererHandle } from './Renderer';
import { createStore } from './store';

type Navigate = RendererHandle['navigate'];

/** Store + engine + capability services for one open mini-app (run screen and create preview). */
export function createSession(id: string, spec: Spec, signal?: AbortSignal) {
  let navigate: Navigate | undefined;
  const store = createStore(id, spec.state, () => toast("Couldn't save. Your changes are still open. Try again."));
  const engine = createActionEngine({
    spec, store,
    services: {
      share, toast, confirm, notify: notifyNow, navigate: (to) => navigate?.(to),
      ai: createAiService({ spec, store, getProvider: getActiveProvider, signal }),
    },
    getValueContext: () => ({
      now: new Date(), locale: Intl.DateTimeFormat().resolvedOptions().locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: preferredCurrency(),
      onWarning: (m) => console.warn(`spec: ${m}`),
    }),
  });
  return { store, engine, setNavigate: (fn: Navigate | undefined) => { navigate = fn; } };
}
