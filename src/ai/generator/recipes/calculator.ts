import { compileFormula, FormulaError, parseFormula, type Step } from './formula';
import { assemble, RecipeError, tree, type Obj } from './kit';
import { cleanText, first, icon, identifier, nameFromRequest, type Settings } from './settings';
import type { Recipe } from './types';

export type CalcInput = { key: string; label: string; kind: 'number' | 'money' | 'percent' | 'date'; value: number | string | null };
export type CalcOutput = { label: string; formula: string; format: 'number' | 'currency' | 'percent' };
export type CalcConfig = { name: string; icon: string; description: string; inputs: CalcInput[]; outputs: CalcOutput[] };

const MAX_STEPS = 8;

export function buildCalculator(c: CalcConfig, notes: string[] = []): Obj {
  const names = new Map(c.inputs.map((i) => [i.key.toLowerCase(), { key: i.key, type: i.kind === 'date' ? 'date' as const : 'number' as const }]));
  const taken = new Set(c.inputs.map((i) => i.key));
  const fresh = (stem: string) => { let n = 1; while (taken.has(`${stem}${n}`)) n++; taken.add(`${stem}${n}`); return `${stem}${n}`; };

  // Compile every output; keep as many as fit in one action. Formulas that need hidden values switch the whole app to a Calculate button.
  const compiled: { out: CalcOutput; value: unknown; steps: Step[] }[] = [];
  let used = 0;
  for (const out of c.outputs) {
    const { value, steps } = compileFormula(parseFormula(out.formula), (n) => names.get(n.toLowerCase()), () => fresh('calc'));
    if (used + steps.length + 1 > MAX_STEPS) { notes.push(`“${out.label}” was left out: too long to calculate in one go.`); continue; }
    used += steps.length + 1;
    compiled.push({ out, value, steps });
  }
  if (!compiled.length) throw new RecipeError('No formula fits in one calculation.');
  const button = compiled.some((x) => x.steps.length > 0);

  const state: Obj = Object.fromEntries(c.inputs.map((i) => [i.key, i.kind === 'date' ? { type: 'date', default: i.value } : { type: 'number', default: i.value }]));
  const stepsOut: Obj[] = [];
  const t = tree();
  const fields = c.inputs.map((i) => i.kind === 'date' ? t.add('DateInput', { bind: i.key, label: i.label })
    : t.add('NumberInput', { bind: i.key, label: i.kind === 'percent' && !i.label.includes('%') ? `${i.label} (%)` : i.label, mode: 'field' }));
  const stats = compiled.map(({ out, value, steps }) => {
    let shown = value;
    if (button) {
      for (const s of steps) { state[s.path] = { type: 'number', default: 0, persist: false }; stepsOut.push({ op: 'state.set', path: s.path, value: s.value }); }
      const key = fresh('result');
      state[key] = { type: 'number', default: 0, persist: false };
      stepsOut.push({ op: 'state.set', path: key, value });
      shown = { $ref: key };
    }
    return t.add('Stat', { label: out.label, value: shown, format: out.format });
  });
  const inputCard = t.add('Card', { title: 'Inputs' }, [...fields, ...(button ? [t.add('Button', { label: 'Calculate', onPress: 'calculate', variant: 'primary' })] : [])]);
  const resultCard = t.add('Card', { title: 'Results' }, stats);
  const root = t.add('Stack', { gap: 'md' }, [inputCard, resultCard]);
  return assemble({ name: c.name, description: c.description, icon: c.icon }, state, root, t.elements,
    button ? { calculate: { steps: stepsOut } } : {});
}

const KINDS = new Set(['number', 'money', 'percent', 'date']);

function parseInputs(lines: string[], notes: string[]): CalcInput[] {
  const out: CalcInput[] = [];
  for (const line of lines) {
    const words = line.replace(/[:=,|]/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    if (out.length >= 5) { notes.push('Only 5 inputs fit, so the rest were left out.'); continue; }
    const kind = words[1] && KINDS.has(words[1].toLowerCase()) ? (words[1].toLowerCase() as CalcInput['kind']) : 'number';
    let rest = words.slice(KINDS.has((words[1] ?? '').toLowerCase()) ? 2 : 1);
    const last = rest[rest.length - 1];
    const isDay = kind === 'date' && last !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(last);
    const isNum = kind !== 'date' && last !== undefined && /^-?\d+(\.\d+)?$/.test(last);
    const value = isDay ? last : isNum ? Number(last) : kind === 'date' ? null : 0;
    if (isDay || isNum) rest = rest.slice(0, -1);
    const key = identifier(words[0], 'value', out.map((x) => x.key));
    out.push({ key, kind, value: typeof value === 'number' && !Number.isFinite(value) ? 0 : value, label: cleanText(rest.join(' '), 30) || cleanText(words[0].replace(/([a-z])([A-Z])/g, '$1 $2'), 30) || key });
  }
  return out;
}

function parseOutputs(lines: string[], inputs: CalcInput[], notes: string[]): CalcOutput[] {
  const names = new Map(inputs.map((i) => [i.key.toLowerCase(), { key: i.key, type: i.kind === 'date' ? 'date' as const : 'number' as const }]));
  const out: CalcOutput[] = [];
  for (const line of lines) {
    const at = line.indexOf('=');
    if (at < 1) continue;
    if (out.length >= 4) { notes.push(`Only 4 results fit, so “${line.slice(0, at).trim()}” was left out.`); continue; }
    const label = cleanText(line.slice(0, at), 30);
    let formula = line.slice(at + 1).trim();
    const as = /\s+as\s+(\w+)\s*$/i.exec(formula);
    if (as) formula = formula.slice(0, as.index);
    const word = (as?.[1] ?? '').toLowerCase();
    const format = /^(money|currency|dollars?)$/.test(word) ? 'currency' : word === 'percent' ? 'percent' : 'number';
    try {
      compileFormula(parseFormula(formula), (n) => names.get(n.toLowerCase()), () => 'probe');
      out.push({ label: label || 'Result', formula, format });
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      notes.push(label ? `Left out “${label}”: couldn’t read its formula.` : 'Left out a result: couldn’t read its formula.');
    }
  }
  return out;
}

export function parseCalculator(s: Settings, request: string, notes: string[] = []): CalcConfig {
  const inputs = parseInputs(s.get('input') ?? [], notes);
  if (!inputs.length) throw new RecipeError('The calculator has no inputs.');
  const outputs = parseOutputs(s.get('output') ?? [], inputs, notes);
  if (!outputs.length) throw new RecipeError('The calculator has no working formula.');
  const name = cleanText(first(s, 'name'), 40, nameFromRequest(request));
  return { name, icon: icon(first(s, 'icon'), '🧮'), description: cleanText(first(s, 'description'), 140, `${name}: type the numbers, see the result`), inputs, outputs };
}

const CONVERTER = /\b(convert\w*|conversion|exchange|currency)\b/i;

export const starterConverter = (request: string): CalcConfig => {
  const name = nameFromRequest(request);
  return {
    name, icon: '🧮', description: `${name}: type the amount and the rate, see the result`,
    inputs: [{ key: 'amount', label: 'Amount', kind: 'number', value: 1 }, { key: 'rate', label: 'Rate (how much one unit is worth)', kind: 'number', value: 1 }],
    outputs: [{ label: 'Result', formula: 'amount * rate', format: 'number' }],
  };
};

export const calculatorRecipe: Recipe = {
  id: 'calculator', version: 1, title: 'Calculator',
  hint: 'type numbers, get results from a formula: converters, tip, loan, interest, BMI, percentages',
  summary: 'The user types some numbers and sees results computed from them: converters, tips, taxes, loans, health formulas and the like.',
  lines: `name <app name, 2-4 words>
icon <one emoji>
description <one short sentence>
input <key> <number|money|percent|date> <label> <starting value>   (1 to 5 lines; key = one word; a date input holds a day and starts empty)
output <label> = <formula using the input keys> as <number|money|percent>   (1 to 4 lines)
Formulas: numbers, input keys, + - * / ^ ( ) and round(x, 2), min(a, b), max(a, b), sqrt(x), days(from, to) for whole days between two dates (today = the current day). A percent input is a plain number, so 15% is 15 and you write tip / 100.
The app has no internet, so a converter takes its rate from the user: input rate number Rate 0.92, output Euros = amount * rate.`,
  example: {
    request: 'Tip calculator',
    reply: `name Tip Calculator
icon 💵
description Work out the tip and what each person pays
input bill money Bill amount 80
input tip percent Tip 15
input people number People 2
output Tip = bill * tip / 100 as money
output Each person pays = (bill + bill * tip / 100) / people as money`,
  },
  make: (s, request, notes = []) => {
    try { return buildCalculator(parseCalculator(s, request, notes), notes); }
    catch (error) {
      // A reply with no usable formula still gives a working converter: the user types the rate. Other calculators cannot guess a formula, so they fall back.
      if (!(error instanceof RecipeError) || !CONVERTER.test(request)) throw error;
      notes.push('No usable formula was found, so this multiplies the amount by a rate you type. Change it with Customize.');
      return buildCalculator(starterConverter(request), notes);
    }
  },
};
