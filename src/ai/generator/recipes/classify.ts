import { RECIPES } from './index';
import type { RecipeId } from './types';

/** A tiny prompt (~200 tokens, one-word answer) for requests the keywords cannot place. */
export function classifyPrompt(): string {
  const ids = Object.keys(RECIPES) as RecipeId[];
  return `Pick the app type that fits the request. Reply with one word from: ${[...ids, 'none'].join(', ')}.
${ids.map((id) => `${id}: ${RECIPES[id].hint}`).join('\n')}
none: nothing above fits`;
}

export function parseClassification(reply: string): RecipeId | undefined {
  const ids = Object.keys(RECIPES) as RecipeId[];
  const words = reply.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.map((w) => ids.find((id) => id === w)).find((id) => id !== undefined);
}
