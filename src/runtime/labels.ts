import type { Spec } from '@/spec/types';

const human = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** The words a user sees for a state field: the label of the form field that fills it (`newX`, `fixX`, `editX`), else the key spelled out. */
export function fieldLabel(spec: Spec, key: string): string {
  const cap = key[0].toUpperCase() + key.slice(1);
  for (const prefix of ['new', 'fix', 'edit']) {
    for (const e of Object.values(spec.elements ?? {})) {
      const p = e.props as { bind?: unknown; label?: unknown };
      if (p.bind === prefix + cap && typeof p.label === 'string' && !p.label.includes('{{')) return p.label;
    }
  }
  return human(key);
}

/** "a", "a and b", "a, b and c". */
export const joinWords = (items: string[]) => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** A label used mid-sentence loses its capital, a "(hint)" and a trailing "?". */
export const inline = (label: string) => label.replace(/\s*\([^)]*\)/g, '').replace(/[?.!]+$/, '').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());
