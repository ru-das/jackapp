import type { Spec } from '@/spec/types';

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Saved values the new spec would stop showing (ADR-039). Same key and type keeps data (the store restores it);
 * a key added by the new spec takes its declared default; a removed key or changed type is reported here.
 */
export function dataAtRisk(oldSpec: Spec, newSpec: Spec, saved: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, old] of Object.entries(oldSpec.state)) {
    const value = saved[key];
    if (old.persist === false || isEmpty(value) || JSON.stringify(value) === JSON.stringify(old.default)) continue;
    const next = newSpec.state[key];
    if (!next || next.type !== old.type) { out.push(key); continue; }
    if (old.type !== 'list' || next.type !== 'list' || !Array.isArray(value)) continue;
    for (const [field, type] of Object.entries(old.of)) {
      const kept = next.of[field] === type;
      if (!kept && value.some((row) => !isEmpty((row as Record<string, unknown> | null)?.[field]))) out.push(`${key}.${field}`);
    }
  }
  return out;
}
