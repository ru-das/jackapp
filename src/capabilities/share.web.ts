import { toast } from './toast';

export async function share(text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e; // AbortError = user closed the sheet
    }
    return;
  }
  await navigator.clipboard.writeText(text);
  toast('Copied to clipboard');
}
