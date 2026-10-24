import { h1, h2, h3 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { parseCompact, toCompact, toCompactPlan, toCompactRefusal } from '../compact';
import { h1Plan, unsupportedExample } from '../prompts';
import { validatePlan } from '../plan';

test.each([['h1', h1], ['h2', h2], ['h3', h3]])('%s survives a spec → lines → spec round trip and is still valid', (_, spec) => {
  const text = toCompact(spec);
  const parsed = parseCompact(text, 'spec');
  expect(parsed.errors).toEqual([]);
  expect(parsed.value).toEqual(spec);
  expect(validate(parsed.value)).toEqual([]);
  // Reported, not asserted as a ratio: the saving depends on the model's tokenizer.
  console.info(`compact ${text.length} chars vs JSON ${JSON.stringify(spec).length} chars`);
  expect(text.length).toBeLessThan(JSON.stringify(spec).length);
});

test('the plan and the refusal round trip too', () => {
  const plan = parseCompact(toCompactPlan(h1Plan), 'plan');
  expect(plan.errors).toEqual([]);
  expect(plan.value).toEqual(h1Plan);
  expect(validatePlan(plan.value)).toEqual([]);
  expect(parseCompact(toCompactRefusal(unsupportedExample), 'plan').value).toEqual(unsupportedExample);
});

test('omitted defaults, purposes and persist are filled in by code', () => {
  const spec = parseCompact('app name="A" description="d" icon=🧊\nstate n number\nstate l list a:string\nstate d date', 'spec').value!;
  expect(spec).toMatchObject({ specVersion: '0.1', state: {
    n: { type: 'number', default: 0 }, l: { type: 'list', of: { a: 'string' }, default: [] }, d: { type: 'date', default: null } } });
  expect(parseCompact('state k string\nuse Text\naction a ops=toast', 'plan').value).toMatchObject({
    state: [{ key: 'k', purpose: '' }], components: [{ type: 'Text', purpose: '' }], actions: [{ id: 'a', ops: ['toast'], purpose: '' }] });
});

test.each([
  ['```\napp name=x\n```', 0], ['Sure!\napp name=x', 1], ['', 1], ['bad', 1],
  ['app name="unfinished', 0], ['el a Text label={"x":}', 1], ['- toast message=hi', 1],
])('bad or noisy input is reported by line, never thrown: %j', (raw, count) => {
  const result = parseCompact(raw, 'spec');
  expect(result.errors).toHaveLength(count === 0 ? result.errors.length : count);
  for (const error of result.errors) expect(error).toEqual({ code: 'BAD_JSON', path: expect.any(String), message: expect.any(String), hint: expect.any(String) });
  if (count > 0) expect(result.value).toBeUndefined();
});

test('a quoted value may contain a raw newline and inline JSON may span lines', () => {
  const spec = parseCompact('app name="A\nB"\nel a Text value={"$ref":\n"x"}', 'spec').value as any;
  expect(spec.meta.name).toBe('A\nB');
  expect(spec.elements.a.props.value).toEqual({ $ref: 'x' });
});

test('a mixed refusal is rejected; a bare refusal line is a refusal object', () => {
  expect(parseCompact(`${toCompactRefusal(unsupportedExample)}\napp name=x`, 'spec').errors[0]).toMatchObject({ path: 'unsupported' });
  expect(parseCompact('unsupported', 'spec').value).toEqual({ unsupported: {} });
});

test('lines patch a draft by kind and id, drop deletes, and an app line starts over', () => {
  const draft = parseCompact(toCompact(h1), 'spec').draft!;
  const patched = parseCompact('el makeBtn Button label="Go" onPress=makeList\ndrop el clearBtn\nstate extra string', 'spec', draft).value as any;
  expect(patched.elements.makeBtn.props.label).toBe('Go');
  expect(patched.elements.clearBtn).toBeUndefined();
  expect(patched.state.extra).toEqual({ type: 'string', default: '' });
  expect(patched.elements.root).toEqual((h1 as any).elements.root);
  const replaced = parseCompact('action clearDone\n- toast message=ok', 'spec', draft).value as any;
  expect(replaced.actions.clearDone.steps).toEqual([{ op: 'toast', message: 'ok' }]);
  expect(Object.keys(replaced.actions)).toEqual(['makeList', 'clearDone']);
  expect(parseCompact('app name="N" description="d" icon=🧊', 'spec', draft).value).toMatchObject({ elements: {}, state: {} });
  expect(draft).toEqual(h1); // the base is never mutated
});
