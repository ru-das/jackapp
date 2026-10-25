import { SpecSchema } from '@/spec/schema';
import { RECIPES } from '../index';
import { rebuild } from '../rebuild';
import { readSettings, writeSettings } from '../settings';

const counter = () => {
  const settings = readSettings(RECIPES.counter.example.reply);
  const spec = RECIPES.counter.make(settings, 'water');
  spec.meta = { ...(spec.meta as object), recipe: { id: 'counter', version: 1, settings: writeSettings(settings) } };
  return SpecSchema.parse(spec);
};

describe('rebuild', () => {
  it('changes the counter step and keeps the recipe info', () => {
    const r = rebuild(counter(), 'name Water\nnoun glasses\nstep 5');
    expect(r.ok && JSON.stringify(r.spec.actions.add)).toContain('"by":5');
    expect(r.ok && r.spec.meta.recipe?.settings).toContain('step 5');
  });
  it('reports an unusable reminder instead of throwing', () => {
    const settings = readSettings(RECIPES.reminder.example.reply);
    const spec = SpecSchema.parse({ ...RECIPES.reminder.make(settings, 'x'), });
    const withInfo = { ...spec, meta: { ...spec.meta, recipe: { id: 'reminder' as const, version: 1, settings: '' } } };
    const r = rebuild(withInfo, 'name W\nreminder daily soon');
    expect(r.ok).toBe(false);
  });
  it('refuses an app without recipe info', () => {
    const spec = counter();
    delete spec.meta.recipe;
    expect(rebuild(spec, 'step 2').ok).toBe(false);
  });
});
