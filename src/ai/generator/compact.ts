import type { SpecError } from '@/spec/types';
import type { TargetStage, Unsupported } from './outputSchemas';
import { formatValue, LITERAL, parseValue } from './shorthand';

// The one wire format between the model and the generator (ADR-023, ADR-024): plain lines, with the UI as an indented tree.
// It compiles to the same objects the validator already checks.
type Obj = Record<string, unknown>;
export type Parsed = {
  raw: string; errors: SpecError[];
  /** Best-effort object even when lines were bad; kept so a repair can patch it. */
  draft?: Obj;
  /** Set only when every line parsed. */
  value?: Obj;
};

const SPEC_KINDS = ['app', 'state', 'screen', 'action', '-', 'trigger', 'unsupported', 'drop'];
const PLAN_KINDS = ['app', 'state', 'screen', 'use', 'action', 'trigger', 'unsupported'];
const DROPPABLE: Record<string, string> = { state: 'state', action: 'actions', screen: 'screens', trigger: 'triggers' };

const hint = (plan: boolean) => plan
  ? 'One item per line: app, state, screen, use, action, trigger. Write key=value, with text in double quotes.'
  : 'One item per line: app, state, screen with an indented tree of components, action with "- op" steps, trigger. Write key=value, with text in double quotes.';

function zero(type: unknown) {
  return type === 'list' ? [] : type === 'string' ? '' : type === 'number' ? 0 : type === 'boolean' ? false : null;
}

type Line = { no: number; indent: number; tokens: string[] };

// Splits on whitespace outside quotes and {} []; a raw newline inside quotes becomes \n so JSON.parse accepts it.
function lines(text: string): Line[] {
  const out: Line[] = [];
  let tokens: string[] = [];
  let cur = '';
  let depth = 0, quote = false, escaped = false, no = 1, start = 1, lead = 0, indent = 0, started = false;
  const push = () => { if (cur) tokens.push(cur); cur = ''; };
  const end = () => { push(); if (tokens.length) out.push({ no: start, indent, tokens }); tokens = []; lead = 0; started = false; };
  for (const ch of text) {
    if (quote) {
      cur += ch === '\n' ? '\\n' : ch;
      if (ch === '\n') no++;
      if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '\n') { no++; if (depth > 0) { cur += ' '; continue; } end(); start = no; continue; }
    if (!started && (ch === ' ' || ch === '\t')) { lead += ch === '\t' ? 2 : 1; continue; }
    if (!started) { started = true; indent = lead; }
    if (ch === '"') quote = true;
    else if (ch === '{' || ch === '[') depth++;
    else if ((ch === '}' || ch === ']') && depth > 0) depth--;
    else if (/\s/.test(ch) && depth === 0) { push(); continue; }
    cur += ch;
  }
  end();
  return out;
}

const isPair = (token: string) => /^[A-Za-z_$][\w$]*=/.test(token);

/** Splits tokens into key=value pairs and everything else. `op` is set for action steps (see shorthand.ts). */
function pairs(tokens: string[], bad: (message: string) => void, op?: string) {
  const kv: Obj = {};
  const rest: string[] = [];
  for (const token of tokens) {
    if (!isPair(token)) { rest.push(token); continue; }
    const eq = token.indexOf('=');
    try { kv[token.slice(0, eq)] = parseValue(token.slice(0, eq), token.slice(eq + 1), op); }
    catch { bad(`Cannot read the value in ${token.slice(0, 60)}`); }
  }
  return { kv, rest };
}

const upsert = (list: Obj[], item: Obj) => {
  const at = list.findIndex((entry) => entry.id === item.id);
  if (at < 0) list.push(item); else list[at] = item;
};

type Frame = { indent: number; id: string | null };
type ScreenBlock = { screen: Obj; roots: string[]; oldRoot?: string; cleared: boolean };

/**
 * `base` is the previous draft of a spec: the lines are then merged into it (a patch). Plan responses are always whole.
 * Components are a tree by indentation; ids are generated unless a line carries `#id`.
 */
export function parseCompact(raw: string, target: TargetStage, base?: Obj): Parsed {
  const plan = target === 'plan';
  const errors: SpecError[] = [];
  const bad = (path: string, message: string) => errors.push({ code: 'BAD_JSON', path, message, hint: hint(plan) });
  const ls = lines(raw).filter((line) => !line.tokens[0].startsWith('```'));
  const patching = !plan && base !== undefined;
  const d: Obj = patching ? JSON.parse(JSON.stringify(base)) as Obj
    : plan ? { name: '', icon: '', summary: '', state: [], screens: [], components: [], actions: [], triggers: [], unsupported: null }
      : { specVersion: '0.1', meta: {}, state: {}, screens: [], elements: {}, actions: {} };
  const list = (key: string) => d[key] as Obj[];
  const map = (key: string) => d[key] as Record<string, Obj>;
  const elements = plan ? {} : map('elements');
  const taken = new Set(Object.keys(elements));
  const nextId = (type: string) => {
    const stem = type[0].toLowerCase() + type.slice(1);
    let n = 1;
    while (taken.has(stem + n)) n++;
    taken.add(stem + n);
    return stem + n;
  };
  const removeTree = (id: string | undefined) => {
    const el = id === undefined ? undefined : elements[id];
    if (!el || id === undefined) return;
    delete elements[id];
    for (const child of (el.children ?? []) as string[]) removeTree(child);
  };
  const detach = (id: string) => {
    for (const el of Object.values(elements)) if (Array.isArray(el.children)) el.children = el.children.filter((c) => c !== id);
    for (const screen of list('screens')) if (screen.root === id) delete screen.root;
  };

  const kinds = plan ? PLAN_KINDS : SPEC_KINDS;
  let stack: Frame[] = [];
  let block: ScreenBlock | undefined;
  const blocks: ScreenBlock[] = [];
  let steps: unknown[] | undefined;
  let refusal: Obj | undefined;
  let others = 0, recognised = 0;

  for (const { no, indent, tokens } of ls) {
    const [head, ...args] = tokens;
    const at = `line ${no}`;
    const component = !plan && /^[A-Z][A-Za-z0-9]*$/.test(head);
    if (!component && !kinds.includes(head)) { bad(at, `Unknown line "${tokens.join(' ').slice(0, 60)}"`); continue; }
    recognised++;
    if (component) while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const before = errors.length;
    const step = head === '-' ? args.find((token) => !isPair(token)) : undefined;
    const { kv, rest } = pairs(args, (message) => bad(at, message), step);
    // A line with an unreadable value is not applied, and neither is anything nested under it.
    if (errors.length > before) { if (component) stack.push({ indent, id: null }); continue; }
    // The plan's vocabulary leaks into FILL because the plan is part of its input (E2B copied `purpose=` onto state lines); no spec field is called purpose.
    if (!plan) delete kv.purpose;
    const id = rest[0];
    if (head === 'unsupported') { refusal = kv; continue; }
    others++;
    if (component) {
      const parent = stack[stack.length - 1];
      if (parent && parent.id === null) { stack.push({ indent, id: null }); continue; }
      let parentId = parent?.id;
      const marker = rest.find((token) => token.startsWith('#'));
      const stray = rest.find((token) => token !== marker);
      if (stray) { bad(at, `Unexpected "${stray.slice(0, 40)}" on the ${head} line; write props as key=value`); stack.push({ indent, id: null }); continue; }
      const own = marker ? marker.slice(1) : undefined;
      if (!block && !parent) {
        if (patching) {
          if (!own || !elements[own]) {
            // A model that forgot the #id still meant "add this": put it in the first screen's root container.
            const root = list('screens')[0]?.root as string | undefined;
            if (root && ['Stack', 'Card'].includes(String(elements[root]?.type))) parentId = root;
            else {
              bad(at, 'In a patch, start a component line with its #id (see the draft)');
              stack.push({ indent, id: null }); continue;
            }
          }
        } else {
          const screen = { id: 'main', title: String((d.meta as Obj).name ?? 'App') };
          list('screens').push(screen);
          blocks.push(block = { screen, roots: [], cleared: true });
        }
      }
      if (block && !block.cleared) { removeTree(block.oldRoot); block.cleared = true; }
      const key = own ?? nextId(head);
      if (elements[key] && !patching) { bad(at, `#${key} is used twice`); stack.push({ indent, id: null }); continue; }
      const old = elements[key];
      taken.add(key);
      elements[key] = { type: head, props: kv, ...(old?.children ? { children: old.children } : {}) };
      if (!old) {
        if (parentId) {
          const holder = elements[parentId];
          holder.children = [...((holder.children ?? []) as string[]), key];
        } else block?.roots.push(key);
      }
      stack.push({ indent, id: key });
    } else if (head === 'app') {
      if (plan) { for (const key of ['name', 'icon', 'summary']) if (key in kv) d[key] = kv[key]; } else d.meta = kv;
    } else if (head === 'state') {
      const type = rest[1];
      const fields = rest.slice(2).filter((t) => /^\w+:\w+/.test(t)).map((t) => t.split(':').slice(0, 2));
      if (!id || !type) { bad(at, 'state needs a key and a type'); continue; }
      const field = fields.length ? { of: Object.fromEntries(fields) } : {};
      if (plan) list('state').push({ key: id, type, ...field, purpose: '', ...kv });
      else map('state')[id] = { type, ...field, default: zero(type), ...kv };
    } else if (head === 'screen') {
      if (!id) { bad(at, 'screen needs an id'); continue; }
      stack = [];
      if (plan) { list('screens').push({ id, purpose: '', ...kv }); continue; }
      delete kv.root;
      const oldRoot = list('screens').find((s) => s.id === id)?.root as string | undefined;
      const screen = { id, ...kv, ...(oldRoot ? { root: oldRoot } : {}) };
      upsert(list('screens'), screen);
      blocks.push(block = { screen, roots: [], oldRoot, cleared: !oldRoot });
    } else if (head === 'use') {
      if (!id) { bad(at, 'use needs a component type'); continue; }
      list('components').push({ type: id, purpose: '', ...kv });
    } else if (head === 'action') {
      if (!id) { bad(at, 'action needs an id'); continue; }
      if (plan) {
        const ops = typeof kv.ops === 'string' ? kv.ops.split(',').filter(Boolean) : kv.ops ?? [];
        list('actions').push({ id, purpose: '', ...kv, ops });
      } else map('actions')[id] = { steps: steps = [] };
    } else if (head === '-') {
      if (!steps) { bad(at, 'A "- op" step must come under an action line'); continue; }
      if (!step) { bad(at, 'A step needs an op name after "-", then field=value pairs'); continue; }
      steps.push({ op: step, ...kv });
    } else if (head === 'trigger') {
      if (!id) { bad(at, 'trigger needs an id'); continue; }
      const trigger = { id, type: 'schedule', ...kv };
      if (plan) list('triggers').push(trigger);
      else { d.triggers ??= []; upsert(list('triggers'), trigger); }
    } else if (head === 'drop') {
      if (id?.startsWith('#')) {
        if (!elements[id.slice(1)]) { bad(at, `No component ${id} in the draft`); continue; }
        detach(id.slice(1)); removeTree(id.slice(1));
        continue;
      }
      const key = DROPPABLE[id ?? ''];
      if (!key || !rest[1]) { bad(at, 'drop needs #id, or state, screen, action or trigger and an id'); continue; }
      if (key === 'screens') removeTree(list('screens').find((s) => s.id === rest[1])?.root as string | undefined);
      if (Array.isArray(d[key])) d[key] = (d[key] as Obj[]).filter((entry) => entry.id !== rest[1]);
      else delete (d[key] as Obj)[rest[1]];
    }
  }

  for (const { screen, roots } of blocks) {
    if (roots.length > 1) {
      // Several top-level components: a small model forgot the container, and one is easy to add.
      const wrapper = nextId('Stack');
      elements[wrapper] = { type: 'Stack', props: {}, children: roots };
      screen.root = wrapper;
    } else if (roots.length === 1) screen.root = roots[0];
  }
  if (!ls.length) bad('', 'The response had no lines.');
  if (refusal) {
    if (others) bad('unsupported', 'A refusal must be the unsupported line alone, with no other lines.');
    else return { raw, errors, ...(errors.length ? {} : { value: { unsupported: refusal } }) };
  }
  return { raw, errors, ...(recognised ? { draft: d } : {}), ...(errors.length || !recognised ? {} : { value: d }) };
}

const bare = (text: string) => /^[^\s"{}[\]]+$/.test(text) && text !== '>' && !LITERAL.test(text);
const fmt = (value: unknown) => typeof value === 'string' && bare(value) ? value : JSON.stringify(value);
const kv = (obj: Obj, skip: string[] = [], op?: string) => Object.entries(obj)
  .filter(([key, value]) => !skip.includes(key) && value !== undefined).map(([key, value]) => `${key}=${formatValue(key, value, op)}`);
const row = (...parts: (string | string[])[]) => parts.flat().filter(Boolean).join(' ');
const fields = (of: unknown) => of ? Object.entries(of as Obj).map(([name, type]) => `${name}:${String(type)}`) : [];

const appLine = (spec: Obj) => row('app', kv((spec.meta ?? {}) as Obj, ['sourcePrompt', 'generatedBy']));
const stateLine = (key: string, d: Obj) => row('state', key, String(d.type), fields(d.of),
  kv(d, ['type', 'of', ...(JSON.stringify(d.default) === JSON.stringify(zero(d.type)) ? ['default'] : [])]));
const screenLine = ({ id, root: _root, ...rest }: Obj) => row('screen', String(id), kv(rest));
const elementLine = (id: string, el: Obj, depth: number, ids: boolean) =>
  row(`${'  '.repeat(depth)}${String(el.type)}`, ids ? [`#${id}`] : [], kv((el.props ?? {}) as Obj));
const actionLines = (id: string, a: { steps: Obj[] }) => [`action ${id}`,
  ...a.steps.map(({ op, ...rest }) => row('-', String(op), kv(rest, [], String(op))))];
const triggerLine = ({ id, ...rest }: Obj) => row('trigger', String(id), kv(rest, ['type']));

/** `ids` adds `#id` to every component; the repair view needs them, the prompt example does not. */
export function toCompact(spec: Obj, ids = false): string {
  const state = (spec.state ?? {}) as Record<string, Obj>;
  const elements = (spec.elements ?? {}) as Record<string, Obj>;
  const actions = (spec.actions ?? {}) as Record<string, { steps: Obj[] }>;
  const seen = new Set<string>();
  const tree = (id: unknown, depth: number): string[] => {
    const el = typeof id === 'string' ? elements[id] : undefined;
    if (!el || seen.has(id as string)) return [];
    seen.add(id as string);
    return [elementLine(id as string, el, depth, ids),
      ...((Array.isArray(el.children) ? el.children : []) as string[]).flatMap((child) => tree(child, depth + 1))];
  };
  return [
    appLine(spec),
    ...Object.entries(state).map(([key, d]) => stateLine(key, d)),
    ...((spec.screens ?? []) as Obj[]).flatMap((screen) => [screenLine(screen), ...tree(screen.root, 1)]),
    ...Object.entries(actions).flatMap(([id, a]) => actionLines(id, a)),
    ...((spec.triggers ?? []) as Obj[]).map(triggerLine),
  ].join('\n');
}

/**
 * Only the lines the errors point at, components with their #id, so a repair rewrites a few lines instead of copying the whole app.
 * `raw` is the response the errors came from (unreadable lines are shown as written). Undefined means "show the full draft":
 * some error has no single line to point at, or nothing could be located.
 */
export function toCompactSlice(spec: Obj, errors: SpecError[], raw: string): string | undefined {
  const out: string[] = [];
  const add = (...texts: string[]) => { for (const text of texts) if (!out.includes(text)) out.push(text); };
  const rawLines = raw.split('\n');
  const elements = (spec.elements ?? {}) as Record<string, Obj>;
  const state = (spec.state ?? {}) as Record<string, Obj>;
  const actions = (spec.actions ?? {}) as Record<string, { steps: Obj[] }>;
  for (const { code, path } of errors) {
    if (code === 'TREE') return undefined;
    const line = /^line (\d+)$/.exec(path);
    if (line) {
      const at = Number(line[1]) - 1;
      if (rawLines[at] === undefined) return undefined;
      if (rawLines[at].trimStart().startsWith('- ')) {
        const owner = rawLines.slice(0, at).reverse().find((text) => text.startsWith('action '));
        if (owner) add(owner);
      }
      add(rawLines[at].trimEnd());
      continue;
    }
    const [, kind, key] = /^(elements|state|actions)\.([^.[\]]+)/.exec(path) ?? [];
    const index = /^(screens|triggers)\[(\d+)\]/.exec(path);
    if (kind === 'elements' && elements[key]) add(elementLine(key, elements[key], 0, true));
    else if (kind === 'state' && state[key]) add(stateLine(key, state[key]));
    else if (kind === 'actions' && actions[key]) add(...actionLines(key, actions[key]));
    else if (index?.[1] === 'screens' && (spec.screens as Obj[])?.[Number(index[2])]) add(screenLine((spec.screens as Obj[])[Number(index[2])]));
    else if (index?.[1] === 'triggers' && (spec.triggers as Obj[])?.[Number(index[2])]) add(triggerLine((spec.triggers as Obj[])[Number(index[2])]));
    else if (path === 'meta' || path.startsWith('meta.')) add(appLine(spec));
    else return undefined;
  }
  return out.length ? out.join('\n') : undefined;
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
