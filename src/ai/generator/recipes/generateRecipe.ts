import { SpecSchema } from '@/spec/schema';
import type { SpecError } from '@/spec/types';
import { validate } from '@/spec/validate';
import { checkCancellation } from '../fill';
import type { GenerateOptions, GenerationResult } from '../generate';
import { RECIPES } from './index';
import { classifyPrompt, parseClassification } from './classify';
import { matchRecipe, refusalGate } from './match';
import { recipePrompt } from './prompt';
import { RecipeError } from './kit';
import { readSettings } from './settings';

/** `fallback`: nothing ready-made fits, so the caller should generate freely (cloud model, or this one). */
export type RecipeOutcome = GenerationResult | { status: 'fallback' };

/**
 * The on-device path (ADR-027): refuse in code, pick the app type from the wording, ask the model for a few setting lines, build the app.
 * One model call and no repair: a bad reply falls back to the app type's defaults, so the result is always a valid app.
 */
export async function generateRecipe(options: GenerateOptions): Promise<RecipeOutcome> {
  const progress = (stage: 'building' | 'checking' | 'done' | 'unsupported' | 'failed', errors?: SpecError[]) => {
    try { options.onProgress?.({ stage, target: 'spec', attempt: 0, ...(errors ? { errors } : {}) }); }
    catch (error) { console.warn('Generation progress listener failed', error); }
  };
  const unsupported = (u: NonNullable<ReturnType<typeof refusalGate>>): GenerationResult => {
    progress('unsupported');
    return { status: 'unsupported', unsupported: u, repairs: 0 };
  };
  try {
    checkCancellation(options.signal);
    const refusal = refusalGate(options.prompt);
    if (refusal) return unsupported(refusal);
    const match = await matchRecipe(options.prompt);
    progress('building');
    let id = match.id;
    if (!match.confident) {
      // Unsure wording: one tiny call decides between the types, or says none of them.
      const answer = await options.provider.generate({
        system: classifyPrompt(), messages: [{ role: 'user', content: `Request: ${options.prompt}` }],
        stage: 'fill', maxTokens: 8, temperature: 0, plainText: true, ...(options.signal ? { signal: options.signal } : {}),
      });
      checkCancellation(options.signal);
      const said = parseClassification(answer);
      // Only an explicit "none" (or nothing readable and no keyword guess) sends the request to free-form generation.
      id = said ?? (/\bnone\b/i.test(answer) ? undefined : match.id);
    }
    if (!id) return { status: 'fallback' };
    const recipe = RECIPES[id];
    const reply = await options.provider.generate({
      system: recipePrompt(recipe), messages: [{ role: 'user', content: `Request: ${options.prompt}` }],
      stage: 'fill', maxTokens: 400, temperature: 0.2, plainText: true,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    checkCancellation(options.signal);

    progress('checking');
    let spec;
    try { spec = recipe.make(readSettings(reply), options.prompt); }
    catch (error) {
      // The reply cannot make a working app of this type (e.g. no usable formula): let the free-form path try.
      if (error instanceof RecipeError) return { status: 'fallback' };
      throw error;
    }
    // Metadata is assigned here, never taken from the model, as in the free-form path.
    spec.meta = { ...(spec.meta as object), sourcePrompt: options.prompt, generatedBy: { provider: options.provider.id, model: options.model } };
    const errors = validate(spec);
    if (errors.length) {
      // A builder bug, not a model mistake: surface it instead of saving a broken app.
      console.error('recipe produced an invalid spec', recipe.id, errors);
      progress('failed', errors);
      return { status: 'failed', repairs: 0, errors, message: 'I couldn’t build this mini-app. Try a simpler request.' };
    }
    const result: GenerationResult = { status: 'done', spec: SpecSchema.parse(spec), repairs: 0 };
    progress('done');
    return result;
  } catch (error) {
    const cancelled = options.signal?.aborted || (error instanceof Error && error.name === 'AbortError');
    const errors: SpecError[] = [{ code: 'SHAPE', path: 'recipe', message: error instanceof Error ? error.message : String(error),
      hint: cancelled ? 'Start again when ready.' : 'Check the loaded provider and try again.' }];
    progress('failed', errors);
    return { status: 'failed', repairs: 0, errors, message: cancelled ? 'Generation cancelled.' : 'The model couldn’t finish. Please try again.' };
  }
}
