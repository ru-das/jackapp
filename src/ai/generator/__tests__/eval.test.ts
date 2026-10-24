import corpus from '../../../../evals/prompts.json';
import { h1 } from '@/spec/fixtures';
import { ActionStepSchema, ComponentNameSchema } from '@/spec/schema';
import { createScriptedMock, mockProvider } from '../../providers/mock';
import { QUICK_IDS, runEval } from '../eval';
import { h1Plan } from '../prompts';
import * as generation from '../generate';
import type { ErrorCode } from '@/spec/types';

jest.mock('../../provider', () => { throw new Error('Eval must not load platform providers'); });
const plan = JSON.stringify(h1Plan);
const spec = JSON.stringify(h1);
const refusal = JSON.stringify({ unsupported: { reason: 'Cannot do that', missing: ['capability'], suggestion: 'Try a checklist' } });

test('corpus has stable ordered ids, 25 supported and 5 unsupported with registered requirements', () => {
  expect(corpus.map((row) => row.id)).toEqual(Array.from({ length: 30 }, (_, i) => `e${String(i + 1).padStart(2, '0')}`));
  expect(corpus.filter((row) => row.expect === 'spec')).toHaveLength(25);
  expect(corpus.slice(25).every((row) => row.expect === 'unsupported')).toBe(true);
  for (const row of corpus) {
    expect(row.prompt.length).toBeGreaterThan(10);
    for (const component of row.mustUse ?? []) expect(ComponentNameSchema.safeParse(component).success).toBe(true);
    for (const op of row.mustOps ?? []) expect(ActionStepSchema.options.some((schema) => schema.shape.op.value === op)).toBe(true);
  }
});

test('unknown filter rejects before inference, including empty id', async () => {
  const provider = createScriptedMock([]);
  const calls = jest.spyOn(provider, 'generate');
  await expect(runEval(provider, 'test', { only: 'missing' })).rejects.toThrow('Unknown eval prompt');
  await expect(runEval(provider, 'test', { only: '' })).rejects.toThrow('Unknown eval prompt');
  await expect(runEval(provider, 'test', { only: ['e01', 'missing'] })).rejects.toThrow('Unknown eval prompt');
  expect(calls).not.toHaveBeenCalled();
});

test.each([false, true])('filter and pipeline noPlan=%s, result serializes and callback is isolated', async (noPlan) => {
  const provider = createScriptedMock(noPlan ? [spec] : [plan, spec]);
  const calls = jest.spyOn(provider, 'generate');
  const output = await runEval(provider, 'test', { noPlan, only: 'e01', onResult: (row) => { row.result.status = 'failed'; } });
  expect(output.rows).toHaveLength(1);
  expect(output.rows[0]).toMatchObject({ id: 'e01', expect: 'spec', firstFillValid: true, result: { status: 'done' }, missingRequirements: { components: [], ops: [] } });
  expect(calls).toHaveBeenCalledTimes(noPlan ? 1 : 2);
  expect(output.options).toEqual({ noPlan, only: 'e01' });
  expect(JSON.parse(JSON.stringify(output))).toEqual(output);
  for (const target of Object.values(output.targets)) expect(target.met).toBeNull();
});

test('PLAN repair preserves first FILL success; FILL repair disqualifies it', async () => {
  const a = await runEval(createScriptedMock(['bad', plan, spec]), 'test', { only: 'e01' });
  const b = await runEval(createScriptedMock([plan, 'bad', spec]), 'test', { only: 'e01' });
  expect(a.metrics.firstFillValidity).toEqual({ count: 1, denominator: 1, rate: 1 });
  expect(b.metrics.firstFillValidity).toEqual({ count: 0, denominator: 1, rate: 0 });
  expect(a.topErrors).toEqual([{ code: 'BAD_JSON', count: 1 }]);
  expect(b.metrics.validWithinTwoRepairs.rate).toBe(1);
});

test('repeated terminal diagnostics count once per attempt; provider failure keeps prior errors', async () => {
  const a = await runEval(createScriptedMock(['bad', 'bad', 'bad']), 'test', { only: 'e01', noPlan: true });
  expect(a.topErrors).toEqual([{ code: 'BAD_JSON', count: 3 }]);
  const b = await runEval(createScriptedMock(['bad', new Error('offline')]), 'test', { only: 'e01', noPlan: true });
  expect(b.topErrors).toEqual([{ code: 'BAD_JSON', count: 1 }, { code: 'SHAPE', count: 1 }]);
  expect(b.rows[0].result).toMatchObject({ status: 'failed', repairs: 0 });
});

test('requirements are separate from validator errors and empty denominators are null', async () => {
  const missing = await runEval(createScriptedMock([spec]), 'test', { only: 'e04', noPlan: true });
  expect(missing.rows[0].missingRequirements).toEqual({ components: [], ops: ['share'] });
  expect(missing.metrics.requirementsSatisfied).toEqual({ count: 0, denominator: 1, rate: 0 });
  expect(missing.topErrors).toEqual([]);
  const unsupported = await runEval(createScriptedMock([refusal]), 'test', { only: 'e26', noPlan: true });
  expect(unsupported.metrics.firstFillValidity.rate).toBeNull();
  expect(unsupported.metrics.requirementsSatisfied.rate).toBeNull();
  expect(unsupported.metrics.medianLatencyMs).toBeNull();
  expect(unsupported.metrics.refusalPrecision.rate).toBe(1);
});

test('suite executes sequentially in corpus order, survives individual failures and scores denominators and median', async () => {
  let now = 0;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const responses = [spec, spec, new Error('offline'), ...Array<string>(22).fill(refusal), spec, refusal, refusal, refusal, refusal];
  const provider = createScriptedMock(responses);
  const original = provider.generate;
  let active = 0;
  let index = 0;
  const prompts: string[] = [];
  provider.generate = async (request) => {
    expect(active++).toBe(0);
    prompts.push(JSON.parse(request.messages[0].content).request);
    await Promise.resolve();
    now += ++index * 100;
    active--;
    return original(request);
  };
  const rows: string[] = [];
  try {
    const output = await runEval(provider, 'test', { noPlan: true, onResult: (row) => { rows.push(row.id); } });
    expect(prompts).toEqual(corpus.map((row) => row.prompt));
    expect(rows).toEqual(corpus.map((row) => row.id));
    expect(output.metrics).toMatchObject({
      firstFillValidity: { count: 2, denominator: 25, rate: 2 / 25 },
      validWithinTwoRepairs: { count: 2, denominator: 25, rate: 2 / 25 },
      requirementsSatisfied: { count: 2, denominator: 2, rate: 1 },
      correctRefusals: { count: 4, denominator: 5, rate: 0.8 },
      refusalRecall: { count: 4, denominator: 5, rate: 0.8 },
      refusalPrecision: { count: 4, denominator: 26, rate: 4 / 26 },
      falseRefusals: { count: 22, denominator: 25, rate: 22 / 25 },
      medianLatencyMs: 150, latencySamples: 2,
    });
    expect(output.targets.correctRefusals.met).toBe(true);
    expect(output.targets.validWithinTwoRepairs.met).toBe(false);
    expect(output.targets.falseRefusals.met).toBe(false);
  } finally { clock.mockRestore(); }
});

test('default mock completes suite; throwing callback is isolated', async () => {
  const provider = { ...mockProvider };
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const output = await runEval(provider, 'test', { onResult: () => { throw new Error('UI'); } });
    expect(output.rows).toHaveLength(30);
    expect(output.metrics.validWithinTwoRepairs.count).toBeGreaterThan(0);
    expect(warning).toHaveBeenCalledTimes(30);
  } finally { warning.mockRestore(); }
});

test('odd latency populations use the middle successful expected-spec sample', async () => {
  let now = 0;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  const provider = createScriptedMock([spec, spec, spec, ...Array<string>(27).fill(refusal)]);
  const original = provider.generate;
  let index = 0;
  provider.generate = async (request) => { now += ++index * 100; return original(request); };
  try {
    const output = await runEval(provider, 'test', { noPlan: true });
    expect(output.metrics.medianLatencyMs).toBe(200);
    expect(output.metrics.latencySamples).toBe(3);
  } finally { clock.mockRestore(); }
});


test('error ranking sorts by frequency then code and retains five', async () => {
  const codes: ErrorCode[] = ['TREE', 'SHAPE', 'BAD_VALUE', 'BAD_PROP', 'BAD_JSON', 'BAD_ACTION', 'TREE'];
  const errors = codes.map((code, index) => ({ code, path: String(index), message: 'test' }));
  const pipeline = jest.spyOn(generation, 'generate').mockImplementation(async (options) => {
    options.onProgress?.({ stage: 'failed', target: 'spec', attempt: 2, errors });
    return { status: 'failed', repairs: 2, message: 'test', errors };
  });
  try {
    const output = await runEval(createScriptedMock([]), 'test', { only: 'e01' });
    expect(output.topErrors).toEqual([
      { code: 'TREE', count: 2 }, { code: 'BAD_ACTION', count: 1 },
      { code: 'BAD_JSON', count: 1 }, { code: 'BAD_PROP', count: 1 }, { code: 'BAD_VALUE', count: 1 },
    ]);
  } finally { pipeline.mockRestore(); }
});

test('QUICK_IDS runs only those prompts, in corpus order, as a partial run', async () => {
  const output = await runEval(mockProvider, 'test', { only: QUICK_IDS });
  expect(output.rows.map((r) => r.id)).toEqual([...QUICK_IDS]);
  expect(output.options.only).toEqual([...QUICK_IDS]);
  expect(output.targets.firstFillValidity.met).toBeNull();
});
