import type { Obj } from './kit';
import type { Settings } from './settings';

export type RecipeId = 'log' | 'counter' | 'splitter' | 'ai-list';

/** A ready-made app type: the model fills in its settings, `make` returns a Spec-shaped object that is valid by construction. */
export interface Recipe {
  id: RecipeId;
  title: string;
  /** One or two sentences for the model: what this app type is. */
  summary: string;
  /** The setting lines the model writes, one per line, with a short hint each. */
  lines: string;
  example: { request: string; reply: string };
  make(settings: Settings, request: string): Obj;
}
