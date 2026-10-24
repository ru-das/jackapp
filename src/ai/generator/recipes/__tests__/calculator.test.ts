import { validate } from '@/spec/validate';
import { resolveValue } from '@/spec/values';
import type { Value } from '@/spec/types';
import { buildCalculator, parseCalculator } from '../calculator';
import { compileFormula, parseFormula } from '../formula';
import { RecipeError } from '../kit';
import { readSettings } from '../settings';

type Spec = { state: Record<string, { default: unknown }>; elements: Record<string, { type: string; props: Record<string, unknown> }>; actions: Record<string, { steps: { op: string; path: string; value: Value }[] }> };

/** Runs the app the way the runtime would: apply the Calculate steps in order, then read every Stat. */
function run(reply: string, inputs: Record<string, number> = {}, request = 'calculator') {
  const spec = buildCalculator(parseCalculator(readSettings(reply), request)) as unknown as Spec;
  expect(validate(spec)).toEqual([]);
  const state: Record<string, unknown> = { ...Object.fromEntries(Object.entries(spec.state).map(([k, d]) => [k, d.default])), ...inputs };
  const warnings: string[] = [];
  const context = () => ({ state, now: new Date('2026-10-25T12:00:00Z'), locale: 'en-US', timeZone: 'UTC', onWarning: (m: string) => warnings.push(m) });
  for (const step of spec.actions.calculate?.steps ?? []) state[step.path] = resolveValue(step.value, context());
  const results = Object.fromEntries(Object.values(spec.elements).filter((e) => e.type === 'Stat')
    .map((e) => [e.props.label as string, resolveValue(e.props.value as Value, context())]));
  return { spec, results, button: 'calculate' in spec.actions, warnings };
}

const head = 'name Calc\nicon 🧮\n';

describe('calculators compute the right numbers', () => {
  test('shallow formulas stay live, with no button', () => {
    const r = run(`${head}input bill money Bill 80\ninput tip percent Tip 15\noutput Tip = bill * tip / 100 as money\noutput Total = bill + bill * tip / 100 as money`);
    expect(r.results).toEqual({ Tip: 12, Total: 92 });
    expect(r.button).toBe(false);
  });

  test('tip per person is four levels deep, so it gets a Calculate button', () => {
    const r = run(`${head}input bill money Bill 80\ninput tip percent Tip 15\ninput people number People 2\noutput Tip = bill * tip / 100 as money\noutput Each pays = (bill + bill * tip / 100) / people as money`);
    expect(r.results).toEqual({ Tip: 12, 'Each pays': 46 });
    expect(r.button).toBe(true);
  });

  test('currency converter with a typed rate', () => {
    expect(run(`${head}input amount money Amount 100\ninput rate number Rate 1.08\noutput Converted = amount * rate as money`).results).toEqual({ Converted: 108 });
  });

  test('compound interest uses pow', () => {
    const r = run(`${head}input principal money Principal 1000\ninput rate percent Rate 5\ninput years number Years 10\noutput Final amount = principal * (1 + rate / 100) ^ years as money`);
    expect(r.results['Final amount']).toBeCloseTo(1628.894627, 5);
  });

  test('mortgage payment is deep, so it switches to a Calculate button with hidden values', () => {
    const r = run(`${head}input loan money Loan 200000\ninput rate percent Yearly rate 5\ninput years number Years 30\noutput Monthly payment = loan * (rate / 1200) * (1 + rate / 1200) ^ (years * 12) / ((1 + rate / 1200) ^ (years * 12) - 1) as money`);
    expect(r.button).toBe(true);
    expect(r.results['Monthly payment']).toBeCloseTo(1073.64, 2);
    expect(Object.keys(r.spec.state).length).toBeGreaterThan(4);
  });

  test.each([
    ['BMI', 'input weight number Weight 70\ninput height number Height 175\noutput BMI = weight / (height / 100) ^ 2', 22.857142857, undefined],
    ['percent literal', 'input price money Price 50\noutput Sale = price - price * 20%', 40, undefined],
    ['sqrt', 'input a number A 3\ninput b number B 4\noutput Hypotenuse = sqrt(a ^ 2 + b ^ 2)', 5, undefined],
    ['round', 'input a number A 10\ninput b number B 3\noutput Rounded = round(a / b, 2)', 3.33, undefined],
    ['max of three', 'input a number A 2\ninput b number B 9\noutput Biggest = max(a, b, 5)', 9, undefined],
    ['unary minus and precedence', 'input a number A 2\noutput Value = -a ^ 2 + 10 / 4 * 2', 1, undefined],
    ['case-insensitive names', 'input Bill money Bill 10\noutput Double = BILL * 2', 20, undefined],
  ])('%s', (_, body, expected) => {
    const r = run(`${head}${body}`);
    expect(Object.values(r.results)[0]).toBeCloseTo(expected as number, 5);
  });

  test('division by zero shows 0 with a warning instead of breaking', () => {
    const r = run(`${head}input a number A 1\ninput b number B 0\noutput Ratio = a / b`);
    expect(r.results.Ratio).toBe(0);
    expect(r.warnings).toContain('Division by zero.');
  });
});

describe('bad formulas', () => {
  test('a broken or unknown-name output is dropped; the rest still works', () => {
    const r = run(`${head}input a number A 3\noutput Good = a * 2\noutput Bad = a +\noutput Unknown = a * zzz\noutput Weird = a $ 2`);
    expect(Object.keys(r.results)).toEqual(['Good']);
  });

  test.each([['no inputs', 'output X = 1 + 1'], ['no outputs', 'input a number A 1'], ['only broken outputs', 'input a number A 1\noutput X = a +']])(
    '%s is not a calculator', (_, body) => expect(() => run(`${head}${body}`)).toThrow(RecipeError));

  test('more outputs than one calculation can hold are trimmed, never invalid', () => {
    const deep = '((((a + 1) * (a + 2)) * ((a + 3) * (a + 4))) * (((a + 5) * (a + 6)) * ((a + 7) * (a + 8))))';
    const r = run(`${head}input a number A 1\noutput One = ${deep}\noutput Two = ${deep}\noutput Three = ${deep}\noutput Four = ${deep}`);
    expect(Object.keys(r.results).length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(r.results).length).toBeLessThan(4);
  });

  test('hostile labels and keys cannot open template expressions', () => {
    const r = run(`${head}input {{x}} number {{evil}} 1\noutput {{items|count}} = x * 2`);
    expect(JSON.stringify(r.spec)).not.toContain('{{');
  });

  test('inputs are capped at five and outputs at four', () => {
    const lines = Array.from({ length: 8 }, (_, i) => `input v${i} number V${i} ${i}`).join('\n');
    const outs = Array.from({ length: 8 }, (_, i) => `output O${i} = v0 + ${i}`).join('\n');
    const r = run(`${head}${lines}\n${outs}`);
    expect(Object.values(r.spec.elements).filter((e) => e.type === 'NumberInput')).toHaveLength(5);
    expect(Object.keys(r.results)).toHaveLength(4);
  });
});

test('formula parser rejects what it cannot read', () => {
  for (const bad of ['', '1 +', '(1', '1 2', 'foo(1)', 'round(1, x)', 'min(1)', '1 $ 2']) {
    expect(() => compileFormula(parseFormula(bad), (n) => n, () => 't')).toThrow();
  }
});

test('hoisting keeps every compiled value within three nested math nodes', () => {
  const depth = (v: unknown): number => (typeof v === 'object' && v !== null && '$math' in v
    ? 1 + Math.max(...(v as { $math: unknown[] }).$math.slice(1).map(depth)) : 0);
  const { value, steps } = compileFormula(parseFormula('((a+1)*(a+2)+(a+3)*(a+4))*((a+5)*(a+6)+(a+7)*(a+8))'), () => 'a', (() => { let n = 0; return () => `t${++n}`; })());
  expect(depth(value)).toBeLessThanOrEqual(3);
  for (const s of steps) expect(depth(s.value)).toBeLessThanOrEqual(3);
});
