export interface ConfirmOptions {
  /** Short question naming the action; `message` then holds the consequence. */
  title?: string;
  /** Button text naming the action ("Delete"); the browser dialog cannot show it. */
  confirmLabel?: string;
  destructive?: boolean;
}

export async function confirm(message: string, { title }: ConfirmOptions = {}): Promise<boolean> {
  return window.confirm(title ? `${title}\n\n${message}` : message);
}
