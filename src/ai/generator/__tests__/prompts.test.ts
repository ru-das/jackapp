import { h1 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { parseCompact } from '../compact';
import { outputSchema, PlanSchema, UnsupportedSchema } from '../outputSchemas';
import { validatePlan } from '../plan';
import { h1Plan, systemPrompt, unsupportedExample } from '../prompts';

test.each([['plan', 'plan'], ['fill', 'spec'], ['repair', 'plan'], ['repair', 'spec']] as const)(
  '%s/%s prompt contains shared instructions and exactly two valid examples', (stage, target) => {
    const prompt = systemPrompt(stage, target);
    for (const text of ['plain text lines only', 'only catalog components', 'unsupported', 'Aim for 5–15 elements', 'with no other fields', 'ai.run prompts must ask only']) {
      expect(prompt).toContain(text);
    }
    expect(prompt.match(/Example \d/g)).toHaveLength(2);
    const examples = prompt.split(/Example \d — [^\n]+:\n/).slice(1).map((raw) => parseCompact(raw, target));
    for (const example of examples) expect(example.errors).toEqual([]);
    expect(UnsupportedSchema.safeParse(examples[1].value).success).toBe(true);
    if (target === 'plan') expect(validatePlan(examples[0].value)).toEqual([]);
    else expect(validate(examples[0].value)).toEqual([]);
    if (stage === 'repair') expect(prompt).toContain(`REPAIR target: ${target}`);
  },
);

test('plan validation checks types and registry names but permits unfinished references', () => {
  expect(validatePlan(h1Plan)).toEqual([]);
  expect(validatePlan({ ...h1Plan, screens: [{ id: 'unfinished id', purpose: '' }] })).toEqual([]);
  expect(validatePlan({ ...h1Plan, triggers: [{ id: 'unfinished id', type: 'schedule',
    schedule: { kind: 'weekly', weekday: 99, time: 'decide later' }, notify: { title: '', body: '' } }] })).toEqual([]);
  for (const patch of [
    { name: 3 }, { state: [{ key: 'x', type: 'object', purpose: '' }] },
    { components: [{ type: 'Canvas', purpose: '' }] },
    { actions: [{ id: 'x', purpose: '', ops: ['fetch'] }] }, { unsupported: {} },
  ]) expect(validatePlan({ ...h1Plan, ...patch }).length).toBeGreaterThan(0);
  expect(PlanSchema.parse({ ...h1Plan, extra: true })).not.toHaveProperty('extra');
});

test('schemas are generated with local references and constrain fill to catalog props', () => {
  for (const target of ['plan', 'spec'] as const) {
    const schema = outputSchema(target);
    expect(schema.$defs).toBeDefined();
    const json = JSON.stringify(schema);
    expect(json).toContain('unsupported');
    expect(json).toContain('ImageInput');
    expect(json).not.toContain('"const":"Chart"');
    const refs = json.matchAll(/"\$ref":"#\/\$defs\/([^"/]+)"/g);
    for (const [, name] of refs) expect(schema.$defs).toHaveProperty(name);
    console.info(`${target} schema: ${json.length} chars`);
  }
  expect(validate(h1)).toEqual([]);
  expect(UnsupportedSchema.parse(unsupportedExample)).toEqual(unsupportedExample);
});

test('a spec repair that patches says so; plan repairs and rewrites ask for the whole object', () => {
  expect(systemPrompt('repair', 'spec', false, true)).toContain('Return only the lines that change');
  expect(systemPrompt('repair', 'spec', false)).toContain('Return the complete corrected spec');
  expect(systemPrompt('repair', 'plan', false, true)).toContain('Return the complete corrected plan');
});

test('a repair of a real build attempt carries no refusal rule or refusal example; a repair of a refusal keeps both', () => {
  for (const target of ['plan', 'spec'] as const) {
    const noRefusal = systemPrompt('repair', target, false);
    expect(noRefusal).toContain('Never return "unsupported"');
    expect(noRefusal).not.toContain('with no other fields');
    expect(noRefusal).not.toContain('Example 2');
    expect(noRefusal.match(/Example \d/g)).toHaveLength(1);
    expect(systemPrompt('repair', target, true)).toBe(systemPrompt('repair', target));
  }
});
