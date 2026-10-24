// Small formula language for the calculator recipe: numbers, names, + - * / ^ ( ) %, and a few functions. A model writes
// "bill * tip / 100" far more reliably than nested {"$math": [...]} JSON; this turns the text into spec Values.
export class FormulaError extends Error {}

export type Ast =
  | { k: 'num'; v: number } | { k: 'var'; name: string } | { k: 'now' }
  | { k: 'neg'; a: Ast } | { k: 'pct'; a: Ast }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Ast; b: Ast }
  | { k: 'call'; fn: string; args: Ast[] };

const FUNCTIONS: Record<string, [number, number]> = { round: [1, 2], min: [2, 6], max: [2, 6], sqrt: [1, 1], pow: [2, 2], days: [2, 2] };

function tokens(text: string): string[] {
  const out = text.match(/\d+(?:\.\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),%×÷]|\S/g) ?? [];
  return out.map((t) => (t === '×' ? '*' : t === '÷' ? '/' : t));
}

export function parseFormula(text: string): Ast {
  const t = tokens(text.replace(/\s+/g, ' ').trim());
  if (!t.length) throw new FormulaError('Empty formula.');
  let i = 0;
  const peek = () => t[i];
  const take = (expected?: string) => {
    const token = t[i++];
    if (token === undefined || (expected !== undefined && token !== expected)) throw new FormulaError(`Expected ${expected ?? 'more'} in the formula.`);
    return token;
  };
  const atom = (): Ast => {
    const token = take();
    if (/^(\d|\.\d)/.test(token)) return { k: 'num', v: Number(token) };
    if (token === '(') { const inner = sum(); take(')'); return inner; }
    if (/^[A-Za-z_]/.test(token)) {
      if (peek() !== '(') return /^(today|now)$/i.test(token) ? { k: 'now' } : { k: 'var', name: token };
      const fn = token.toLowerCase();
      if (!(fn in FUNCTIONS)) throw new FormulaError(`Unknown function ${token}.`);
      take('(');
      const args: Ast[] = [sum()];
      while (peek() === ',') { take(','); args.push(sum()); }
      take(')');
      const [min, max] = FUNCTIONS[fn];
      if (args.length < min || args.length > max) throw new FormulaError(`${token} takes ${min === max ? min : `${min}–${max}`} arguments.`);
      return { k: 'call', fn, args };
    }
    throw new FormulaError(`Unexpected "${token}" in the formula.`);
  };
  const power = (): Ast => {
    let base = atom();
    while (peek() === '%') { take(); base = { k: 'pct', a: base }; }
    return peek() === '^' ? (take(), { k: 'bin', op: '^', a: base, b: unary() }) : base;
  };
  const unary = (): Ast => (peek() === '-' ? (take(), { k: 'neg', a: unary() }) : peek() === '+' ? (take(), unary()) : power());
  const product = (): Ast => {
    let left = unary();
    while (peek() === '*' || peek() === '/') { const op = take() as '*' | '/'; left = { k: 'bin', op, a: left, b: unary() }; }
    return left;
  };
  function sum(): Ast {
    let left = product();
    while (peek() === '+' || peek() === '-') { const op = take() as '+' | '-'; left = { k: 'bin', op, a: left, b: product() }; }
    return left;
  }
  const ast = sum();
  if (i < t.length) throw new FormulaError(`Unexpected "${t[i]}" in the formula.`);
  return ast;
}

type Compiled = { value: unknown; depth: number };
export type Step = { path: string; value: unknown };

/** `$math` may nest three deep. A deeper formula keeps its deepest parts in hidden values, set by earlier steps. */
export function compileFormula(ast: Ast, names: (name: string) => string | undefined, temp: () => string): { value: unknown; steps: Step[] } {
  const steps: Step[] = [];
  const hoist = (c: Compiled): Compiled => {
    const path = temp();
    steps.push({ path, value: c.value });
    return { value: { $ref: path }, depth: 0 };
  };
  const math = (op: string, a: Compiled, b: Compiled): Compiled => {
    while (1 + Math.max(a.depth, b.depth) > 3) { if (a.depth >= b.depth) a = hoist(a); else b = hoist(b); }
    return { value: { $math: [op, a.value, b.value] }, depth: 1 + Math.max(a.depth, b.depth) };
  };
  const num = (v: number): Compiled => ({ value: v, depth: 0 });
  const node = (n: Ast): Compiled => {
    switch (n.k) {
      case 'num': return num(n.v);
      case 'now': return { value: { $now: true }, depth: 0 };
      case 'var': {
        const key = names(n.name);
        if (!key) throw new FormulaError(`Unknown name ${n.name}.`);
        return { value: { $ref: key }, depth: 0 };
      }
      case 'neg': { const a = node(n.a); return typeof a.value === 'number' ? num(-a.value) : math('-', num(0), a); }
      case 'pct': return math('/', node(n.a), num(100));
      case 'bin': return math(n.op === '^' ? 'pow' : n.op, node(n.a), node(n.b));
      case 'call': {
        const args = n.args.map(node);
        if (n.fn === 'sqrt') return math('pow', args[0], num(0.5));
        if (n.fn === 'round') {
          const digits = n.args[1] === undefined ? 0 : n.args[1].k === 'num' ? n.args[1].v : NaN;
          if (!Number.isInteger(digits) || Math.abs(digits) > 15) throw new FormulaError('round needs a whole number of digits, like round(x, 2).');
          return math('round', args[0], num(digits));
        }
        return args.slice(1).reduce((acc, next) => math(n.fn, acc, next), args[0]);
      }
    }
  };
  return { value: node(ast).value, steps };
}
