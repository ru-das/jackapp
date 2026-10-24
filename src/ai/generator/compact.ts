import type { SpecError } from '@/spec/types';
import type { TargetStage, Unsupported } from './outputSchemas';

// The one wire format between the model and the generator (ADR-023): one item per line, compiled to the same objects the validator already checks.
type Obj = Record<string, unknown>;
export type Parsed = {
  raw: string; errors: SpecError[];
  /** Best-effort object even when lines were bad; kept so a repair can patch it. */
  draft?: Obj;
  /** True when the lines were merged into a base draft instead of starting over. */
  patched?: boolean;
  /** Set only when every line parsed. */
  value?: Obj;
};

const LITERAL = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/;
const SPEC_KINDS = ['app', 'state', 'screen', 'el', 'action', '-', 'trigger', 'unsupported', 'drop'];
const PLAN_KINDS = ['app', 'state', 'screen', 'use', 'action', 'trigger', 'unsupported'];
const DROPPABLE: Record<string, string> = { state: 'state', el: 'elements', action: 'actions', screen: 'screens', trigger: 'triggers' };

const hint = (plan: boolean) => plan
  ? 'One item per line: app, state, screen, use, action, trigger. Write key=value, with text in double quotes.'
  : 'One item per line: app, state, screen, el, action with "- op" steps, trigger. Write key=value, with text in double quotes.';

function zero(type: unknown) {
  return type === 'list' ? [] : type === 'string' ? '' : type === 'number' ? 0 : type === 'boolean' ? false : null;
}

type Line = { no: number; tokens: string[] };

// Splits on whitespace outside quotes and {} []; a raw newline inside quotes becomes \n so JSON.parse accepts it.
function lines(text: string): Line[] {
  const out: Line[] = [];
  let tokens: string[] = [];
  let cur = '';
  let depth = 0, quote = false, escaped = false, no = 1, start = 1;
  const push = () => { if (cur) tokens.push(cur); cur = ''; };
  const end = () => { push(); if (tokens.length) out.push({ no: start, tokens }); tokens = []; };
  for (const ch of text) {
    if (quote) {
      cur += ch === '\n' ? '\\n' : ch;
      if (ch === '\n') no++;
      if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '\n') { no++; if (depth > 0) { cur += ' '; continue; } end(); start = no; continue; }
    if (ch === '"') quote = true;
    else if (ch === '{' || ch === '[') depth++;
    else if ((ch === '}' || ch === ']') && depth > 0) depth--;
    else if (/\s/.test(ch) && depth === 0) { push(); continue; }
    cur += ch;
  }
  end();
  return out;
}

const parseValue = (text: string): unknown => /^["{[]/.test(text) || LITERAL.test(text) ? JSON.parse(text) : text;

/** Splits tokens into key=value pairs and everything else. */
function pairs(tokens: string[], bad: (message: string) => void) {
  const kv: Obj = {};
  const rest: string[] = [];
  for (const token of tokens) {
    const eq = token.indexOf('=');
    if (eq > 0 && /^[A-Za-z_$][\w$]*$/.test(token.slice(0, eq))) {
      try { kv[token.slice(0, eq)] = parseValue(token.slice(eq + 1)); }
      catch { bad(`Cannot read the value in ${token.slice(0, 60)}`); }
    } else rest.push(token);
  }
  return { kv, rest };
}

const upsert = (list: Obj[], item: Obj) => {
  const at = list.findIndex((entry) => entry.id === item.id);
  if (at < 0) list.push(item); else list[at] = item;
};

/**
 * `base` is the previous draft of a spec. Lines then patch it by kind and id, unless the response starts over with an `app` line.
 * Plan responses are always whole.
 */
export function parseCompact(raw: string, target: TargetStage, base?: Obj): Parsed {
  const plan = target === 'plan';
  const errors: SpecError[] = [];
  const bad = (path: string, message: string) => errors.push({ code: 'BAD_JSON', path, message, hint: hint(plan) });
  const ls = lines(raw).filter((line) => !line.tokens[0].startsWith('```'));
  const patching = !plan && base !== undefined && !ls.some((line) => line.tokens[0] === 'app');
  const d: Obj = patching ? JSON.parse(JSON.stringify(base)) as Obj
    : plan ? { name: '', icon: '', summary: '', state: [], screens: [], components: [], actions: [], triggers: [], unsupported: null }
      : { specVersion: '0.1', meta: {}, state: {}, screens: [], elements: {}, actions: {} };
  const list = (key: string) => d[key] as Obj[];
  const map = (key: string) => d[key] as Record<string, Obj>;
  const kinds = plan ? PLAN_KINDS : SPEC_KINDS;
  let steps: unknown[] | undefined;
  let refusal: Obj | undefined;
  let others = 0, recognised = 0;

  for (const { no, tokens } of ls) {
    const [head, ...args] = tokens;
    const at = `line ${no}`;
    if (!kinds.includes(head)) { bad(at, `Unknown line "${tokens.join(' ').slice(0, 60)}"`); continue; }
    recognised++;
    const before = errors.length;
    const { kv, rest } = pairs(args, (message) => bad(at, message));
    // A line with an unreadable value is not applied, so a half-read line cannot damage the draft.
    if (errors.length > before) continue;
    const id = args[0];
    if (head === 'unsupported') { refusal = kv; continue; }
    others++;
    if (head === 'app') {
      if (plan) { for (const key of ['name', 'icon', 'summary']) if (key in kv) d[key] = kv[key]; } else d.meta = kv;
    } else if (head === 'state') {
      const type = args[1];
      const of = Object.fromEntries(rest.slice(2).filter((t) => /^\w+:\w+$/.test(t)).map((t) => t.split(':')));
      if (!id || !type) { bad(at, 'state needs a key and a type'); continue; }
      const field = Object.keys(of).length ? { of } : {};
      if (plan) list('state').push({ key: id, type, ...field, purpose: '', ...kv });
      else map('state')[id] = { type, ...field, default: zero(type), ...kv };
    } else if (head === 'screen') {
      if (!id) { bad(at, 'screen needs an id'); continue; }
      if (plan) list('screens').push({ id, purpose: '', ...kv }); else upsert(list('screens'), { id, ...kv });
    } else if (head === 'el') {
      const split = args.indexOf('>');
      const own = pairs(args.slice(2, split < 0 ? undefined : split), () => {});
      if (!id || !args[1]) { bad(at, 'el needs an id and a component type'); continue; }
      const children = split < 0 ? [] : args.slice(split + 1);
      map('elements')[id] = { type: args[1], props: own.kv, ...(children.length ? { children } : {}) };
    } else if (head === 'use') {
      if (!id) { bad(at, 'use needs a component type'); continue; }
      list('components').push({ type: id, purpose: '', ...pairs(args.slice(1), () => {}).kv });
    } else if (head === 'action') {
      if (!id) { bad(at, 'action needs an id'); continue; }
      if (plan) {
        const ops = typeof kv.ops === 'string' ? kv.ops.split(',').filter(Boolean) : kv.ops ?? [];
        list('actions').push({ id, purpose: '', ...kv, ops });
      } else map('actions')[id] = { steps: steps = [] };
    } else if (head === '-') {
      if (!steps) { bad(at, 'A "- op" step must come under an action line'); continue; }
      steps.push({ op: id, ...kv });
    } else if (head === 'trigger') {
      if (!id) { bad(at, 'trigger needs an id'); continue; }
      const trigger = { id, type: 'schedule', ...kv };
      if (plan) list('triggers').push(trigger);
      else { d.triggers ??= []; upsert(list('triggers'), trigger); }
    } else if (head === 'drop') {
      const key = DROPPABLE[id];
      if (!key || !args[1]) { bad(at, 'drop needs state, el, action, screen or trigger, then an id'); continue; }
      if (Array.isArray(d[key])) d[key] = (d[key] as Obj[]).filter((entry) => entry.id !== args[1]);
      else delete (d[key] as Obj)[args[1]];
    }
  }

  if (!ls.length) bad('', 'The response had no lines.');
  if (refusal) {
    if (others) bad('unsupported', 'A refusal must be the unsupported line alone, with no other lines.');
    else return { raw, errors, ...(errors.length ? {} : { value: { unsupported: refusal } }) };
  }
  return { raw, errors, patched: patching, ...(recognised ? { draft: d } : {}), ...(errors.length || !recognised ? {} : { value: d }) };
}

const bare = (text: string) => /^[^\s"{}[\]]+$/.test(text) && text !== '>' && !LITERAL.test(text);
const fmt = (value: unknown) => typeof value === 'string' && bare(value) ? value : JSON.stringify(value);
const kv = (obj: Obj, skip: string[] = []) => Object.entries(obj)
  .filter(([key, value]) => !skip.includes(key) && value !== undefined).map(([key, value]) => `${key}=${fmt(value)}`);
const row = (...parts: (string | string[])[]) => parts.flat().filter(Boolean).join(' ');
const fields = (of: unknown) => of ? Object.entries(of as Obj).map(([name, type]) => `${name}:${String(type)}`) : [];

export function toCompact(spec: Obj): string {
  const state = (spec.state ?? {}) as Record<string, Obj>;
  const elements = (spec.elements ?? {}) as Record<string, Obj>;
  const actions = (spec.actions ?? {}) as Record<string, { steps: Obj[] }>;
  return [
    row('app', kv((spec.meta ?? {}) as Obj, ['sourcePrompt', 'generatedBy'])),
    ...Object.entries(state).map(([key, d]) => row('state', key, String(d.type), fields(d.of),
      kv(d, ['type', 'of', ...(JSON.stringify(d.default) === JSON.stringify(zero(d.type)) ? ['default'] : [])]))),
    ...((spec.screens ?? []) as Obj[]).map(({ id, ...rest }) => row('screen', String(id), kv(rest))),
    ...Object.entries(elements).map(([id, el]) => row('el', id, String(el.type), kv((el.props ?? {}) as Obj),
      Array.isArray(el.children) && el.children.length ? ['>', ...(el.children as string[])] : [])),
    ...Object.entries(actions).flatMap(([id, a]) => [`action ${id}`,
      ...a.steps.map(({ op, ...rest }) => row('-', String(op), kv(rest)))]),
    ...((spec.triggers ?? []) as Obj[]).map(({ id, ...rest }) => row('trigger', String(id), kv(rest, ['type']))),
  ].join('\n');
}

export function toCompactPlan(plan: Obj): string {
  const purpose = (o: Obj) => (o.purpose ? [`purpose=${fmt(o.purpose)}`] : []);
  return [
    row('app', kv(plan, ['state', 'screens', 'components', 'actions', 'triggers', 'unsupported'])),
    ...((plan.state ?? []) as Obj[]).map((s) => row('state', String(s.key), String(s.type), fields(s.of), purpose(s))),
    ...((plan.screens ?? []) as Obj[]).map((s) => row('screen', String(s.id), purpose(s))),
    ...((plan.components ?? []) as Obj[]).map((c) => row('use', String(c.type), kv(c, ['type', 'purpose']), purpose(c))),
    ...((plan.actions ?? []) as Obj[]).map((a) => row('action', String(a.id),
      (a.ops as string[]).length ? [`ops=${(a.ops as string[]).join(',')}`] : [], purpose(a))),
    ...((plan.triggers ?? []) as Obj[]).map(({ id, ...rest }) => row('trigger', String(id), kv(rest, ['type']))),
  ].join('\n');
}

export const toCompactRefusal = (refusal: Unsupported | Obj) =>
  row('unsupported', kv(('unsupported' in refusal ? refusal.unsupported : refusal) as Obj));
