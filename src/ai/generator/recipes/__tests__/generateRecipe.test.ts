import corpus from '../../../../../evals/prompts.json';
import { createScriptedMock } from '../../../providers/mock';
import { generate, type GenerationProgress } from '../../generate';
import { matchSync } from '../match';
import { RECIPES } from '../index';

function setup(responses: (string | Error)[]) {
  const provider = createScriptedMock(responses);
  const calls = jest.spyOn(provider, 'generate');
  const events: GenerationProgress[] = [];
  return { provider, calls, events, run: (prompt: string, extra = {}) => generate({ prompt, provider, model: 'test-model', recipes: true,
    onProgress: (e) => events.push(e), ...extra }) };
}

test('a clear request makes one model call and builds the app from the reply', async () => {
  const { run, calls, events } = setup(['name Plant Pal\nicon 🌱\nnoun plant\nfield name text Plant\nfield lastWatered date Last watered\ntap lastWatered']);
  const result = await run('Track my plants and tap one to record when I watered it.');
  expect(calls).toHaveBeenCalledTimes(1);
  expect(calls.mock.calls[0][0]).toMatchObject({ plainText: true, maxTokens: 400, stage: 'fill' });
  expect(calls.mock.calls[0][0].system).toContain('App type: List app.');
  expect(result).toMatchObject({ status: 'done', repairs: 0, spec: { meta: { name: 'Plant Pal', icon: '🌱', sourcePrompt: expect.stringContaining('plants'),
    generatedBy: { provider: 'mock', model: 'test-model' } } } });
  expect(events.map((e) => e.stage)).toEqual(['building', 'checking', 'done']);
});

test('the gate refuses without calling the model, and the suggestion can be built', async () => {
  const { run, calls, events } = setup([]);
  const result = await run('Build an interactive physics simulation with bouncing objects.');
  expect(result).toMatchObject({ status: 'unsupported', unsupported: { reason: expect.any(String), suggestion: expect.any(String) } });
  expect(calls).not.toHaveBeenCalled();
  expect(events.map((e) => e.stage)).toEqual(['unsupported']);
  if (result.status !== 'unsupported') throw new Error('expected a refusal');
  expect(matchSync(result.unsupported.suggestion).id).toBe('log');
});

test('a request that matches nothing is declined without calling the model', async () => {
  const { run, calls } = setup([]);
  expect(await run('I want an app')).toMatchObject({ status: 'unsupported', unsupported: { missing: ['a matching app type'] } });
  expect(calls).not.toHaveBeenCalled();
});

test.each(['', 'sorry I cannot do that', '{"json": true}', 'name\nfield\ntotal nothing\nreminder soon', 'name {{evil}} \u0000'])(
  'an unusable reply %j still builds a valid app from the defaults', async (reply) => {
    const { run } = setup([reply]);
    const result = await run('Log expenses with a name and amount.');
    expect(result.status).toBe('done');
  });

test('hostile text in the reply cannot add template expressions or break the app', async () => {
  const { run } = setup(['name {{items|count}} "quoted" \\n app\nnoun {{x}}\ndescription ' + 'x'.repeat(500) + '\nfield a{{b}} text {{label}}']);
  const result = await run('Keep a list of things');
  expect(result.status).toBe('done');
  if (result.status !== 'done') return;
  expect(result.spec.meta.name).not.toContain('{');
  expect(result.spec.meta.description.length).toBeLessThanOrEqual(140);
  expect(JSON.stringify(result.spec)).not.toMatch(/\{\{(?!\$item\.[a-zA-Z0-9]+|items\|count|new[A-Za-z0-9]+)/);
});

test('a provider error is a friendly failure; cancellation is reported as cancelled', async () => {
  const failed = await setup([new Error('model not downloaded')]).run('Keep a list of my books');
  expect(failed).toMatchObject({ status: 'failed', message: expect.stringContaining('couldn’t finish'), errors: [expect.objectContaining({ message: 'model not downloaded' })] });
  const controller = new AbortController(); controller.abort();
  expect(await setup([]).run('Keep a list of my books', { signal: controller.signal })).toMatchObject({ status: 'failed', message: 'Generation cancelled.' });
});

// What a model would have to say for each corpus prompt to meet its mustUse / mustOps. Prompts not listed work with an empty reply.
const replies: Record<string, string> = {
  e04: 'share yes', e10: 'share yes', e25: 'share yes',
  e05: 'field name text Plant\nfield lastWatered date Last watered\ntap lastWatered',
  e06: 'field name text Plant\nfield lastWatered date Last watered\ntap lastWatered',
  e07: 'field name text Plant\nfield lastWatered date Last watered\ntap lastWatered',
  e17: 'field name text Pet\nfield fed date Last fed\ntap fed',
  e13: 'field name text Expense\nfield amount money Amount\ntotal amount Total spent',
  e18: 'field name text Subscription\nfield cost money Monthly cost\ntotal cost Monthly total',
  e20: 'field recipient text Recipient\nfield budget money Budget\ntotal budget Total budget',
  e23: 'field subject text Subject\nfield minutes number Minutes\ntotal minutes Total minutes',
  e24: 'field item text Item\nfield price money Price\ntotal price Total',
};

test.each(corpus.filter((row) => row.expect === 'spec'))('corpus $id: the built app has every required component and op', async (row) => {
  const { run } = setup([replies[row.id] ?? '']);
  const result = await run(row.prompt);
  expect(result.status).toBe('done');
  if (result.status !== 'done') return;
  const types = Object.values(result.spec.elements).map((e) => e.type);
  const ops = Object.values(result.spec.actions).flatMap((a) => a.steps.map((s) => s.op));
  for (const component of row.mustUse ?? []) expect(types).toContain(component);
  for (const op of row.mustOps ?? []) expect(ops).toContain(op);
});

test('every recipe example request is matched to its own recipe', () => {
  for (const recipe of Object.values(RECIPES)) expect(matchSync(recipe.example.request).id).toBe(recipe.id);
});
