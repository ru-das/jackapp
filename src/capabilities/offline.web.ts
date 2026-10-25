// Baked in at export time from app.json experiments.baseUrl, "" at root.
const base = process.env.EXPO_BASE_URL ?? '';

export function registerOffline(): void {
  // The dev server has no sw.js, and a cache there would hide edits.
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch((e) => console.warn('[offline] service worker failed', e));
  // Without this the browser may evict saved mini-apps along with the cache when storage is tight.
  void navigator.storage?.persist?.();
}
