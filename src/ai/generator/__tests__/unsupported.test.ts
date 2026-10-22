import { createScriptedMock } from '../../providers/mock';
import { generate, type GenerationProgress } from '../generate';
import { h1Plan, unsupportedExample } from '../prompts';

const plan = JSON.stringify(h1Plan);
const refusal = JSON.stringify(unsupportedExample);
const cases = [
  { name: 'PLAN', responses: [refusal], repairs: 0, target: 'plan' },
  { name: 'FILL', responses: [plan, refusal], repairs: 0, target: 'spec' },
  { name: 'PLAN repair', responses: ['{}', refusal], repairs: 1, target: 'plan' },
  { name: 'spec repair', responses: [plan, '{}', refusal], repairs: 1, target: 'spec' },
  { name: 'last PLAN repair', responses: ['{}', '{}', refusal], repairs: 2, target: 'plan' },
  { name: 'last spec repair after PLAN repair', responses: ['{}', plan, '{}', refusal], repairs: 2, target: 'spec' },
];

test.each(cases)('valid refusal in $name terminates immediately', async ({ responses, repairs, target }) => {
  const provider = createScriptedMock(responses);
  const calls = jest.spyOn(provider, 'generate');
  const events: GenerationProgress[] = [];
  const result = await generate({ prompt: 'Build physics simulation', model: 'mock-model', provider,
    onProgress: (event) => events.push(event) });
  expect(result).toEqual({ status: 'unsupported', unsupported: unsupportedExample.unsupported, repairs });
  expect(result).not.toHaveProperty('spec');
  expect(calls).toHaveBeenCalledTimes(responses.length);
  expect(events.filter((e) => ['done', 'failed', 'unsupported'].includes(e.stage))).toEqual([
    { stage: 'unsupported', target, attempt: repairs },
  ]);
  if (target === 'plan') expect(events.some((e) => e.stage === 'building')).toBe(false);
});

const malformed = [
  { unsupported: true },
  { unsupported: { reason: 42, missing: 'canvas', suggestion: 'calculator' } },
  { unsupported: { reason: ' ', missing: [], suggestion: '' } },
  { unsupported: { reason: 'canvas', missing: ['canvas'] } },
  { ...unsupportedExample, specVersion: '0.1' },
  { ...h1Plan, unsupported: unsupportedExample.unsupported },
];

describe.each(['plan', 'spec'] as const)('malformed refusals at %s stage', (target) => {
  test.each(malformed)('enters repair instead of bypassing validation: %j', async (value) => {
    const raw = JSON.stringify(value);
    const provider = createScriptedMock([...(target === 'spec' ? [plan] : []), raw, refusal]);
    const calls = jest.spyOn(provider, 'generate');
    expect(await generate({ prompt: 'physics', provider, model: 'test' })).toEqual({
      status: 'unsupported', unsupported: unsupportedExample.unsupported, repairs: 1,
    });
    const request = calls.mock.calls.at(-1)![0];
    expect(request.system).toContain(`REPAIR target: ${target}`);
    const feedback = JSON.parse(request.messages[0].content);
    expect(feedback).toMatchObject({ request: 'physics', previousResponse: raw, target });
    expect(feedback.errors.length).toBeGreaterThan(0);
    for (const error of feedback.errors) expect(error).toEqual(expect.objectContaining({
      code: 'SHAPE', path: expect.any(String), message: expect.any(String), hint: expect.any(String),
    }));
  });
});

test('repeated malformed refusals fail after exactly two repairs', async () => {
  const raw = JSON.stringify(malformed[0]);
  const provider = createScriptedMock([raw, raw, raw]);
  const result = await generate({ prompt: 'physics', provider, model: 'test' });
  expect(result).toMatchObject({ status: 'failed', repairs: 2, message: expect.any(String) });
  expect(result).not.toHaveProperty('spec');
  expect(result).not.toHaveProperty('unsupported');
});

test('null unsupported is a supported-plan marker, and invalid in FILL', async () => {
  const provider = createScriptedMock([plan, '{"unsupported":null}', refusal]);
  expect(await generate({ prompt: 'physics', provider, model: 'test' })).toMatchObject({
    status: 'unsupported', repairs: 1,
  });
});
