import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { validate } from '@/spec/validate';
import { RECIPES } from './index';
import { RecipeError } from './kit';
import { readSettings, writeSettings } from './settings';

export type Rebuilt = { ok: true; spec: Spec; notes: string[] } | { ok: false; message: string };

/** Customize: rebuild an app from edited setting lines through the same builder and validator as a first build. */
export function rebuild(spec: Spec, text: string): Rebuilt {
  const info = spec.meta.recipe;
  if (!info) return { ok: false, message: 'This mini-app can’t be customized because it wasn’t built from a ready-made kind.' };
  const settings = readSettings(text);
  const notes: string[] = [];
  let next;
  try { next = RECIPES[info.id].make(settings, spec.meta.sourcePrompt ?? spec.meta.name, notes); }
  catch (error) {
    if (error instanceof RecipeError) return { ok: false, message: error.message };
    throw error;
  }
  const { sourcePrompt, generatedBy } = spec.meta;
  next.meta = {
    ...(next.meta as object), ...(sourcePrompt !== undefined ? { sourcePrompt } : {}), ...(generatedBy ? { generatedBy } : {}),
    recipe: { id: info.id, version: RECIPES[info.id].version, settings: writeSettings(settings).slice(0, 2000) },
  };
  if (validate(next).length) return { ok: false, message: 'Those settings don’t make a working mini-app. Try simpler values.' };
  return { ok: true, spec: SpecSchema.parse(next), notes };
}
