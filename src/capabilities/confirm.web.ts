export async function confirm(message: string): Promise<boolean> {
  return window.confirm(message);
}
