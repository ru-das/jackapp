import { h1, h2, h3 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { parseCompact, toCompact, toCompactPlan, toCompactRefusal } from '../compact';
import { validatePlan } from '../plan';
import { h1Plan, unsupportedExample } from '../prompts';
import { formatValue, parseValue } from '../shorthand';

type Obj = Record<string, any>;
const parse = (text: string, base?: Obj) => parseCompact(text, 'spec', base);
const value = (text: string, base?: Obj) => parse(text, base).value as Obj;

test.each([['h1', h1], ['h2', h2], ['h3', h3]])('%s round trips exactly with ids and compiles to a valid spec without them', (_, spec) => {
  const withIds = parse(toCompact(spec, true));
  expect(withIds.errors).toEqual([]);
  expect(withIds.value).toEqual(spec);
  const text = toCompact(spec);
  const plain = parse(text);
  expect(plain.errors).toEqual([]);
  expect(validate(plain.value)).toEqual([]);
  expect(toCompact(plain.value as Obj)).toBe(text);
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

test('the UI is a tree by indentation with generated ids', () => {
  const spec = value('app name="A" description="d" icon=🧊\nscreen main title="T"\n  Stack gap=md\n    Card title="c"\n      Button label="a"\n      Button label="b"\n    Text value="x"');
  expect(spec.screens).toEqual([{ id: 'main', title: 'T', root: 'stack1' }]);
  expect(spec.elements.stack1.children).toEqual(['card1', 'text1']);
  expect(spec.elements.card1.children).toEqual(['button1', 'button2']);
  expect(spec.elements.button2).toEqual({ type: 'Button', props: { label: 'b' } });
});

test('plan vocabulary copied into FILL is dropped: no spec line has a purpose', () => {
  const spec = value('app name="A" description="d" icon=🧊\nstate photo image purpose="fridge photo"\nscreen main title="T" purpose=x\n  Text value="a" purpose=y\naction a\n- toast message=hi purpose=z');
  expect(JSON.stringify(spec)).not.toContain('purpose');
  expect(spec.state.photo).toEqual({ type: 'image', default: null });
  expect(parseCompact('state k string purpose="p"', 'plan').value).toMatchObject({ state: [{ key: 'k', purpose: 'p' }] });
});

test('an explicit #id is kept and a repeated one is an error', () => {
  expect(value('screen s\n  Stack #root\n    Text #hello value="x"').elements.hello).toBeDefined();
  expect(parse('screen s\n  Stack #a\n    Text #a value="x"').errors[0]).toMatchObject({ path: 'line 3', message: '#a is used twice' });
});

test('forgiving: several top-level components get a Stack, components before a screen get one, flat lists stay valid', () => {
  const wrapped = value('screen s\nText value="a"\nText value="b"');
  expect(wrapped.screens[0].root).toBe('stack1');
  expect(wrapped.elements.stack1).toEqual({ type: 'Stack', props: {}, children: ['text1', 'text2'] });
  const implicit = value('app name="N" description="d" icon=🧊\nText value="a"');
  expect(implicit.screens).toEqual([{ id: 'main', title: 'N', root: 'text1' }]);
  expect(value('screen s root=zzz\n  Text value="a"').screens[0].root).toBe('text1');
});

test('defaults, purposes and persist are filled in by code; extra :type parts are ignored', () => {
  const spec = value('app name="A" description="d" icon=🧊\nstate n number\nstate l list a:string:string b:number\nstate d date');
  expect(spec).toMatchObject({ specVersion: '0.1', state: {
    n: { type: 'number', default: 0 }, l: { type: 'list', of: { a: 'string', b: 'number' }, default: [] }, d: { type: 'date', default: null } } });
  expect(parseCompact('state k string\nuse Text\naction a ops=toast', 'plan').value).toMatchObject({
    state: [{ key: 'k', purpose: '' }], components: [{ type: 'Text', purpose: '' }], actions: [{ id: 'a', ops: ['toast'], purpose: '' }] });
});

test.each([
  ['```\napp name=x\n```', 0], ['Sure!\napp name=x', 1], ['', 1], ['bad', 1],
  ['app name="unfinished', 0], ['Text label={"x":}', 1], ['action a\n- toast message=hi', 0],
  ['action a\n- toast="hi"', 1], ['- toast message=hi', 1], ['Text "hello"', 1],
])('bad or noisy input is reported by line, never thrown: %j', (raw, count) => {
  const result = parse(raw);
  expect(result.errors).toHaveLength(count === 0 ? result.errors.length : count);
  for (const error of result.errors) expect(error).toEqual({ code: 'BAD_JSON', path: expect.any(String), message: expect.any(String), hint: expect.any(String) });
  if (count > 0) expect(result.value).toBeUndefined();
});

test('a bad component line is skipped with everything nested under it, and siblings still parse', () => {
  const result = parse('screen s\n  Stack\n    Card title={"x":}\n      Text value="lost"\n    Text value="kept"');
  expect(result.errors).toHaveLength(1);
  const elements = (result.draft as Obj).elements;
  expect(Object.values(elements).map((e: any) => e.props.value ?? e.type)).toEqual(['Stack', 'kept']);
});

test('a quoted value may contain a raw newline and inline JSON may span lines', () => {
  const spec = value('app name="A\nB"\nscreen s\n  Text value={"$ref":\n"x"}');
  expect(spec.meta.name).toBe('A\nB');
  expect(spec.elements.text1.props.value).toEqual({ $ref: 'x' });
});

test('a mixed refusal is rejected; a bare refusal line is a refusal object', () => {
  expect(parse(`${toCompactRefusal(unsupportedExample)}\napp name=x`).errors[0]).toMatchObject({ path: 'unsupported' });
  expect(parse('unsupported').value).toEqual({ unsupported: {} });
});

describe('shorthand', () => {
  test.each([
    ['image', '@photo', undefined, { $ref: 'photo' }], ['value', '@now', undefined, { $now: true }],
    ['index', '@$index', undefined, { $ref: '$index' }], ['label', '"@x"', undefined, '@x'],
    ['output', 'string', 'ai.run', { type: 'string' }],
    ['output', 'list:name:string,qty:number', 'ai.run', { type: 'list', of: { name: 'string', qty: 'number' } }],
    ['output', '{"type":"number"}', 'ai.run', { type: 'number' }],
    ['where', 'done:true', 'state.remove', { field: 'done', equals: true }],
    ['defaults', 'done:false,qty:"1, 2"', 'ai.run', { done: false, qty: '1, 2' }],
    ['value', 'name:@newPlant,at:@now', 'state.append', { name: { $ref: 'newPlant' }, at: { $now: true } }],
    ['value', 'a:b', 'state.set', 'a:b'], ['output', 'string', undefined, 'string'],
  ])('%s=%s (op %s) reads as %j', (key, text, op, expected) => {
    expect(parseValue(key, text, op)).toEqual(expected);
    expect(parseValue(key, formatValue(key, expected, op), op)).toEqual(expected);
  });

  test('values with no short form fall back to JSON', () => {
    const agg = { $agg: { op: 'sum', of: 'items', field: 'price' } };
    expect(formatValue('value', agg, 'state.set')).toBe(JSON.stringify(agg));
    expect(formatValue('output', { type: 'list', of: { a: 'image' } }, 'ai.run')).toBe('{"type":"list","of":{"a":"image"}}');
    expect(formatValue('where', { field: 'a', equals: null }, 'state.remove')).toBe('{"field":"a","equals":null}');
    expect(formatValue('label', '@x')).toBe('"@x"');
  });

  test('bad shorthand is an error, not a throw', () => {
    expect(parse('action a\n- ai.run output=list:name').errors).toHaveLength(1);
    expect(parse('action a\n- state.remove where=a:1,b:2').errors).toHaveLength(1);
  });
});

describe('patching a draft', () => {
  const draft = () => parse(toCompact(h1, true)).draft as Obj;

  test('a #id line replaces that component in place and keeps its children', () => {
    const spec = value('Card #capture title="New"', draft());
    expect(spec.elements.capture).toEqual({ type: 'Card', props: { title: 'New' }, children: ['photoIn', 'notesIn', 'makeBtn'] });
    expect(spec.elements.root.children).toEqual(['capture', 'listCard']);
  });

  test('a nested line without an id is added to the parent; one with an existing id is replaced in place', () => {
    const spec = value('Card #listCard title="Grocery list"\n  Text value="hi"\n  Button #clearBtn label="Reset" onPress=clearDone', draft());
    expect(spec.elements.listCard.children).toEqual(['list', 'clearBtn', 'text1']);
    expect(spec.elements.clearBtn.props.label).toBe('Reset');
  });

  test('drop #id removes the component, its subtree and its place in the parent', () => {
    const spec = value('drop #listCard', draft());
    expect(spec.elements.listCard).toBeUndefined();
    expect(spec.elements.list).toBeUndefined();
    expect(spec.elements.root.children).toEqual(['capture']);
    expect(parse('drop #nope', draft()).errors[0].message).toContain('No component #nope');
  });

  test('a top-level component line needs an existing #id', () => {
    expect(parse('Text value="x"', draft()).errors[0].message).toContain('start a component line with its #id');
    expect(parse('Text #ghost value="x"', draft()).errors[0].message).toContain('No component #ghost');
  });

  test('state, action and app lines replace by key or id; the base is never mutated', () => {
    const base = draft();
    const spec = value('app name="N" description="d" icon=🧊\nstate extra string\naction clearDone\n- toast message=ok', base);
    expect(spec.meta.name).toBe('N');
    expect(spec.state.extra).toEqual({ type: 'string', default: '' });
    expect(spec.actions.clearDone.steps).toEqual([{ op: 'toast', message: 'ok' }]);
    expect(Object.keys(spec.actions)).toEqual(['makeList', 'clearDone']);
    expect(base).toEqual(h1);
  });

  test('a screen line with a tree replaces that screen UI; a bare screen line keeps it', () => {
    const base = draft();
    const kept = value('screen main title="Renamed"', base);
    expect(kept.screens).toEqual([{ id: 'main', title: 'Renamed', root: 'root' }]);
    expect(kept.elements.root).toBeDefined();
    const redone = value('screen main title="T"\n  Text value="only"', base);
    expect(Object.keys(redone.elements)).toEqual(['text1']);
    expect(redone.screens[0].root).toBe('text1');
  });
});
