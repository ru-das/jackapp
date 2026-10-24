import type { Recipe } from './types';

/** About 300 tokens: the model only fills in a few setting lines, so it needs the lines, a hint each, and one example. */
export function recipePrompt(recipe: Recipe) {
  return `You turn an app request into settings for a ready-made app type. Reply with the setting lines only: no prose, no markdown, no code fences.
App type: ${recipe.title}. ${recipe.summary}
Setting lines:
${recipe.lines}
Example request: ${recipe.example.request}
Example reply:
${recipe.example.reply}`;
}
