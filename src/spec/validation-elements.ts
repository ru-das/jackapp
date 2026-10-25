import { catalog } from '@/catalog';
import { ValueSchema } from './schema';
import { expectType, field, type ItemContext, type ValidationContext } from './validation-context';
import { assignment, template, valueType } from './validation-values';

export type Callers = Map<string, (ItemContext | undefined)[]>;
export function elements(ctx: ValidationContext, invalidProps: Set<string>): Callers {
  const callers: Callers = new Map();
  const call = (action: string, path: string, item?: ItemContext) => {
    ctx.reference('actions', action, path);
    callers.set(action, [...(callers.get(action) ?? []), item]);
  };
  for (const [id, element] of Object.entries(ctx.spec.elements)) {
    if (invalidProps.has(id)) continue;
    const base = `elements.${id}.props`;
    const p = element.props;
    const bindTypes: Record<string, 'string' | 'number' | 'boolean' | 'image' | 'date'> = {
      TextInput: 'string', NumberInput: 'number', Toggle: 'boolean', Select: 'string', ImageInput: 'image', DateInput: 'date',
    };
    if (Object.hasOwn(bindTypes, element.type) && typeof p.bind === 'string') {
      expectType(ctx, ctx.state(p.bind, `${base}.bind`), { type: bindTypes[element.type] }, `${base}.bind`);
    }
    if (element.type === 'Button' && typeof p.onPress === 'string') call(p.onPress, `${base}.onPress`);
    if (element.type === 'TextInput' && typeof p.onSubmit === 'string') call(p.onSubmit, `${base}.onSubmit`);
    const templates: Partial<Record<typeof element.type, string[]>> = {
      Card: ['title', 'subtitle'], Text: ['value'], Stat: ['label', 'currency'], Button: ['label'], Timer: ['label'],
    };
    for (const key of templates[element.type] ?? []) {
      if (typeof p[key] === 'string') template(ctx, p[key], `${base}.${key}`);
    }
    if (element.type === 'Timer') {
      const timer = catalog.Timer.props.parse(p);
      assignment(ctx, timer.seconds, { type: 'number' }, `${base}.seconds`);
      if (timer.onDone) call(timer.onDone, `${base}.onDone`);
    }
    if (element.type === 'Image') assignment(ctx, ValueSchema.parse(p.src), { type: 'image' }, `${base}.src`);
    if (element.type === 'Stat') {
      const stat = catalog.Stat.props.parse(p);
      const type = valueType(ctx, stat.value, `${base}.value`);
      const expected = ['number', 'currency', 'percent'].includes(stat.format) ? 'number'
        : ['date', 'ago'].includes(stat.format) ? 'date' : undefined;
      if (expected) {
        if (!(typeof stat.value === 'string' && expected === 'date' && /^\d{4}-/.test(stat.value))) {
          expectType(ctx, type, { type: expected }, `${base}.value`);
        } else assignment(ctx, stat.value, { type: 'date' }, `${base}.value`);
      } else if (type && !['string', 'number', 'date'].includes(type.type)) {
        ctx.add('TYPE_MISMATCH', `${base}.value`, 'Stat needs a number, string or date.', 'Use a numeric aggregate or a string/number/date state reference.');
      }
    }
    if (element.type === 'List') {
      const list = catalog.List.props.parse(p);
      const decl = ctx.state(list.items, `${base}.items`);
      if (decl && decl.type !== 'list') expectType(ctx, decl, { type: 'list' }, `${base}.items`);
      if (decl?.type !== 'list') continue;
      const item = { of: decl.of, list: list.items };
      for (const key of ['title', 'subtitle', 'trailing'] as const) {
        if (list[key] !== undefined) template(ctx, list[key], `${base}.${key}`, item);
      }
      if (list.checkField) expectType(ctx, field(ctx, decl.of, list.checkField, `${base}.checkField`), { type: 'boolean' }, `${base}.checkField`);
      if (list.flagField) expectType(ctx, field(ctx, decl.of, list.flagField, `${base}.flagField`), { type: 'string' }, `${base}.flagField`);
      if (list.sort) field(ctx, decl.of, list.sort.field, `${base}.sort.field`);
      if (list.onItemPress) call(list.onItemPress, `${base}.onItemPress`, item);
    }
  }
  return callers;
}
