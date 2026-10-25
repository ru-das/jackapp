import type { Spec } from '@/spec/types';
import type { State } from './store';

// A leading = + - @ makes spreadsheets run the cell as a formula, so text cells get a quote prefix.
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const text = typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const row = (cells: unknown[]) => cells.map(cell).join(',');

/** Readable copy of the saved data: one block per list, then one block for single values. Images are left out. */
export function toCsv(spec: Spec, state: State): string {
  const blocks: string[] = [];
  const scalars: unknown[][] = [];
  for (const [key, decl] of Object.entries(spec.state)) {
    if (decl.persist === false || decl.type === 'image') continue;
    if (decl.type !== 'list') { scalars.push([key, state[key]]); continue; }
    const fields = Object.keys(decl.of);
    const rows = Array.isArray(state[key]) ? (state[key] as Record<string, unknown>[]) : [];
    blocks.push([key, row(fields), ...rows.map((r) => row(fields.map((f) => r[f])))].join('\n'));
  }
  if (scalars.length) blocks.push(['settings', row(['name', 'value']), ...scalars.map(row)].join('\n'));
  return blocks.join('\n\n');
}
