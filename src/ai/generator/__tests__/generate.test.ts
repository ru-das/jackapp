import type { LLMProvider } from '../../provider';
import { createScriptedMock, mockProvider } from '../../providers/mock';
import { h1 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { generate, type GenerationProgress } from '../generate';
import { h1Plan } from '../prompts';

jest.mock('../../provider', () => { throw new Error('Generator must not load platform providers'); });
const plan = JSON.stringify(h1Plan);
const spec = JSON.stringify(h1);
const badSpec = { ...h1, screens: [{ id: 'main', title: 'test', root: 'missing' }] };
const bad = JSON.stringify(badSpec);

function setup(responses: (string | Error)[]) {
  const provider = createScriptedMock(responses);
  const calls = jest.spyOn(provider, 'generate');
  const events: GenerationProgress[] = [];
  const options = { prompt: 'Fridge groceries', model: 'test-model', provider,
    onProgress: (event: GenerationProgress) => events.push(event) };
  return { options, calls, events };
}

test('AT-06 repairs a bad spec once; stamps metadata and returns parsed defaults', async () => {
  const { options, calls, events } = setup([plan, bad, spec]);
  const result = await generate(options);
  expect(result.status).toBe('done');
  expect(result.repairs).toBe(1);
  if (result.status !== 'done') throw new Error('Expected success');
  expect(validate(result.spec)).toEqual([]);
  expect(result.spec.meta.sourcePrompt).toBe(options.prompt);
  expect(result.spec.meta.generatedBy).toEqual({ provider: 'mock', model: 'test-model' });
  expect(result.spec.state.notes.persist).toBe(true);
  expect(calls.mock.calls.map(([req]) => [req.temperature, req.maxTokens])).toEqual([[0.4, 1024], [0.2, 3072], [0, 3072]]);
  expect(events.map((e) => e.stage)).toEqual(['planning', 'checking', 'building', 'checking', 'repairing', 'checking', 'done']);
  expect(events.filter((e) => e.stage === 'repairing')).toEqual([{ stage: 'repairing', target: 'spec', attempt: 1, errors: expect.any(Array) }]);
});

test('AT-06 stops after exactly two repairs and exposes no partial spec', async () => {
  const { options, calls, events } = setup([plan, bad, bad, bad]);
  const result = await generate(options);
  expect(result).toMatchObject({ status: 'failed', repairs: 2, message: expect.any(String) });
  expect(result).not.toHaveProperty('spec');
  expect(calls).toHaveBeenCalledTimes(4);
  expect(events.filter((e) => ['done', 'failed', 'unsupported'].includes(e.stage))).toEqual([
    { stage: 'failed', target: 'spec', attempt: 2, errors: expect.any(Array) },
  ]);
});

test('plan and spec repairs share a budget and preserve complete latest feedback', async () => {
  const { options, calls, events } = setup(['{broken}', plan, bad, spec]);
  const result = await generate(options);
  expect(result).toMatchObject({ status: 'done', repairs: 2 });
  const firstRepair = JSON.parse(calls.mock.calls[1][0].messages[0].content);
  expect(firstRepair).toMatchObject({ request: options.prompt, target: 'plan', previousResponse: '{broken}',
    errors: [expect.objectContaining({ code: 'BAD_JSON', hint: expect.any(String) })] });
  expect(calls.mock.calls[1][0]).toMatchObject({ temperature: 0, maxTokens: 1024 });
  const secondRepair = JSON.parse(calls.mock.calls[3][0].messages[0].content);
  const stamped = { ...badSpec, meta: { ...badSpec.meta, sourcePrompt: options.prompt,
    generatedBy: { provider: 'mock', model: options.model } } };
  expect(secondRepair).toEqual({ request: options.prompt, target: 'spec', previousResponse: bad, errors: validate(stamped) });
  expect(secondRepair.errors.length).toBeGreaterThan(1);
  expect(events.filter((e) => e.stage === 'repairing').map((e) => [e.target, e.attempt])).toEqual([['plan', 1], ['spec', 2]]);
});

test('two plan repairs leave no repair budget for FILL', async () => {
  const { options, calls } = setup(['{}', '{}', plan, bad]);
  expect(await generate(options)).toMatchObject({ status: 'failed', repairs: 2 });
  expect(calls).toHaveBeenCalledTimes(4);
});

test('invalid registered names are repaired before FILL', async () => {
  const invalid = JSON.stringify({ ...h1Plan, components: [{ type: 'Canvas', purpose: '' }] });
  const { options, calls } = setup([invalid, plan, spec]);
  expect(await generate(options)).toMatchObject({ status: 'done', repairs: 1 });
  expect(calls.mock.calls[1][0].system).toContain('REPAIR target: plan');
  expect(calls.mock.calls[1][0].messages[0].content).toContain('ImageInput');
  expect(calls.mock.calls[2][0].system).toContain('FILL:');
});

test.each([true, false])('schema capability %s applies to PLAN stages only', async (enabled) => {
  const { options, calls } = setup(['{}', plan, bad, spec]);
  options.provider.caps = { ...options.provider.caps, jsonSchema: enabled };
  expect(await generate(options)).toMatchObject({ status: 'done', repairs: 2 });
  for (const [request] of calls.mock.calls) {
    const planStage = request.system.includes('PLAN:') || request.system.includes('REPAIR target: plan');
    expect(Object.hasOwn(request, 'jsonSchema')).toBe(enabled && planStage);
    if (enabled && planStage) expect(request.jsonSchema).toHaveProperty('$defs');
  }
});

test('model supplied metadata is overwritten before validation, including invalid types', async () => {
  const tampered = JSON.stringify({ ...h1, meta: { ...h1.meta, sourcePrompt: 42, generatedBy: 'fake' } });
  const { options } = setup([plan, tampered]);
  const result = await generate(options);
  expect(result).toMatchObject({ status: 'done', repairs: 0,
    spec: { meta: { sourcePrompt: options.prompt, generatedBy: { provider: 'mock', model: options.model } } } });
});

test.each([0, 1, 2])('provider error on call %s stops without counting a failed repair', async (call) => {
  const { options, calls, events } = setup([...([plan, bad].slice(0, call)), new Error('provider unavailable')]);
  expect(await generate(options)).toMatchObject({ status: 'failed', repairs: 0,
    errors: [expect.objectContaining({ message: 'provider unavailable' })] });
  expect(calls).toHaveBeenCalledTimes(call + 1);
  expect(events.filter((e) => e.stage === 'failed')).toHaveLength(1);
});

test('abort before start performs no calls', async () => {
  const { options, calls, events } = setup([]);
  const controller = new AbortController(); controller.abort();
  expect(await generate({ ...options, signal: controller.signal })).toMatchObject({ status: 'failed', repairs: 0, message: 'Generation cancelled.' });
  expect(calls).not.toHaveBeenCalled();
  expect(events.map((e) => e.stage)).toEqual(['failed']);
});

test('a throwing progress observer cannot duplicate terminal events', async () => {
  const { options, events } = setup([plan, spec]);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const result = await generate({ ...options, onProgress: (event) => {
      events.push(event);
      throw new Error('observer');
    } });
    expect(result.status).toBe('done');
    expect(events.filter((event) => ['done', 'failed', 'unsupported'].includes(event.stage))).toHaveLength(1);
  } finally { warning.mockRestore(); }
});

test('cancellation at a checking event stops before returning a spec', async () => {
  const { options, events } = setup([plan, spec]);
  const controller = new AbortController();
  const result = await generate({ ...options, signal: controller.signal, onProgress: (event) => {
    events.push(event);
    if (event.stage === 'checking' && event.target === 'spec') controller.abort();
  } });
  expect(result).toMatchObject({ status: 'failed', repairs: 0, message: 'Generation cancelled.' });
  expect(events.at(-1)?.stage).toBe('failed');
});

test.each([0, 1, 2])('abort after response on call %s ignores it and spends no repair', async (call) => {
  const { options, calls, events } = setup([plan, bad, spec]);
  const controller = new AbortController();
  const original = calls.getMockImplementation()!;
  let index = 0;
  calls.mockImplementation(async (request) => {
    expect(request.signal).toBe(controller.signal);
    const raw = await original(request);
    if (index++ === call) controller.abort();
    return raw;
  });
  expect(await generate({ ...options, signal: controller.signal })).toMatchObject({ status: 'failed', repairs: 0, message: 'Generation cancelled.' });
  expect(calls).toHaveBeenCalledTimes(call + 1);
  expect(events.at(-1)?.stage).toBe('failed');
});

test('scripted mocks are isolated, ordered, abortable and throw on exhaustion; singleton preserved', async () => {
  const a = createScriptedMock(['one', 'two']);
  const b = createScriptedMock(['other']);
  a.caps.jsonSchema = false;
  expect(b.caps.jsonSchema).toBe(true);
  expect(mockProvider.caps.jsonSchema).toBe(true);
  const request: Parameters<LLMProvider['generate']>[0] = { system: '', messages: [] };
  const controller = new AbortController(); controller.abort();
  await expect(a.generate({ ...request, signal: controller.signal })).rejects.toThrow('aborted');
  await expect(a.generate(request)).resolves.toBe('one');
  await expect(b.generate(request)).resolves.toBe('other');
  await expect(a.generate(request)).resolves.toBe('two');
  await expect(a.generate(request)).rejects.toThrow('exhausted');
  await expect(mockProvider.generate(request)).resolves.toBe('{"ok":true}');
});

test('no-plan starts at FILL, omits plan payload, and retains repairs and metadata', async () => {
  const { options, calls, events } = setup(['{broken}', spec]);
  expect(await generate({ ...options, noPlan: true })).toMatchObject({ status: 'done', repairs: 1,
    spec: { meta: { sourcePrompt: options.prompt, generatedBy: { provider: 'mock', model: options.model } } } });
  expect(JSON.parse(calls.mock.calls[0][0].messages[0].content)).toEqual({ request: options.prompt });
  expect(calls.mock.calls[0][0]).toMatchObject({ temperature: 0.2, maxTokens: 3072 });
  expect(events.map((event) => event.stage)).toEqual(['building', 'checking', 'repairing', 'checking', 'done']);
});

test('diagnostic snapshots cannot mutate repair feedback or failed results', async () => {
  const { options, calls } = setup(['{broken}', '{broken}', '{broken}']);
  const result = await generate({ ...options, noPlan: true, onProgress: (event) => {
    if (event.errors) { event.errors[0].code = 'TREE'; event.errors.length = 0; }
  } });
  expect(JSON.parse(calls.mock.calls[1][0].messages[0].content).errors[0].code).toBe('BAD_JSON');
  expect(result).toMatchObject({ status: 'failed', errors: [{ code: 'BAD_JSON' }] });
});

test('no-plan preserves cancellation and refusals', async () => {
  const { options, calls } = setup([JSON.stringify({ unsupported: {
    reason: 'Needs physics', missing: ['physics'], suggestion: 'Try a calculator',
  } })]);
  expect(await generate({ ...options, noPlan: true })).toMatchObject({ status: 'unsupported', repairs: 0 });
  const controller = new AbortController(); controller.abort();
  expect(await generate({ ...options, noPlan: true, signal: controller.signal })).toMatchObject({ status: 'failed', message: 'Generation cancelled.' });
  expect(calls).toHaveBeenCalledTimes(1);
});
