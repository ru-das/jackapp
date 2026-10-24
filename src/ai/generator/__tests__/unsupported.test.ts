import { createScriptedMock } from '../../providers/mock';
import { toCompactPlan, toCompactRefusal } from '../compact';
import { generate, type GenerationProgress } from '../generate';
import { h1Plan, unsupportedExample } from '../prompts';

const plan = toCompactPlan(h1Plan);
const refusal = toCompactRefusal(unsupportedExample);
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

const refusalFields = 'reason="Needs a canvas" missing=["canvas"] suggestion="Try a calculator"';
const malformed = [
  'unsupported',
  'unsupported reason=42 missing="canvas" suggestion=calculator',
  'unsupported reason=" " missing=[] suggestion=""',
  'unsupported reason="canvas" missing=["canvas"]',
  `unsupported ${refusalFields}\napp name=x`,
  `${toCompactPlan(h1Plan)}\nunsupported ${refusalFields}`,
];

describe.each(['plan', 'spec'] as const)('malformed refusals at %s stage', (target) => {
  test.each(malformed)('enters repair instead of bypassing validation: %j', async (raw) => {
    const provider = createScriptedMock([...(target === 'spec' ? [plan] : []), raw, refusal]);
    const calls = jest.spyOn(provider, 'generate');
    expect(await generate({ prompt: 'physics', provider, model: 'test' })).toEqual({
      status: 'unsupported', unsupported: unsupportedExample.unsupported, repairs: 1,
    });
    const request = calls.mock.calls.at(-1)![0];
    expect(request.system).toContain(`REPAIR target: ${target}`);
    const content = request.messages[0].content;
    expect(content).toContain(`Request: physics\nPrevious response:\n${raw}\nErrors:\n- `);
    expect(content).toMatch(/\n- (SHAPE|BAD_JSON) at /);
  });
});

test('repeated malformed refusals fail after exactly two repairs', async () => {
  const raw = malformed[0];
  const provider = createScriptedMock([raw, raw, raw]);
  const result = await generate({ prompt: 'physics', provider, model: 'test' });
  expect(result).toMatchObject({ status: 'failed', repairs: 2, message: expect.any(String) });
  expect(result).not.toHaveProperty('spec');
  expect(result).not.toHaveProperty('unsupported');
});

test('a plan-shaped answer is invalid in FILL and gets repaired', async () => {
  const provider = createScriptedMock([plan, plan, refusal]);
  expect(await generate({ prompt: 'physics', provider, model: 'test' })).toMatchObject({
    status: 'unsupported', repairs: 1,
  });
});
