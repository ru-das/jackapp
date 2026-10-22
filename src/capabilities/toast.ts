type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  listeners.forEach((l) => l(message));
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
