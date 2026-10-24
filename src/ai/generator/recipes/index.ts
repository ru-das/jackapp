import { aiRecipe } from './ai';
import { calculatorRecipe } from './calculator';
import { counterRecipe } from './counter';
import { logRecipe } from './log';
import { splitterRecipe } from './splitter';
import { timerRecipe } from './timer';
import type { Recipe, RecipeId } from './types';

export const RECIPES: Record<RecipeId, Recipe> = {
  log: logRecipe, counter: counterRecipe, splitter: splitterRecipe, ai: aiRecipe, calculator: calculatorRecipe, timer: timerRecipe,
};
export type { Recipe, RecipeId } from './types';
