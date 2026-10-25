import type { ActionStep, ListFields } from './types';
import { expectType, field, own, type ItemContext, type ValidationContext } from './validation-context';
import { assignment, literalFits, template, valueType, where } from './validation-values';
import { resolveTemplate } from './values';
import type { Callers } from './validation-elements';
import { ActionStepSchema, IdentifierSchema } from './schema';
import { object } from './validation-structure';

function patch(ctx: ValidationContext, values: Extract<ActionStep, { op: 'state.append' }>['value'], of: ListFields,
  path: string, complete: boolean, item?: ItemContext) {
  if (complete) for (const key of Object.keys(of)) if (!own(values, key)) {
    ctx.add('BAD_ACTION', `${path}.${key}`, 'Append is missing a declared field.', `Include every field: ${Object.keys(of).join(', ')}.`);
  }
  for (const [key, value] of Object.entries(values)) {
    const type = field(ctx, of, key, `${path}.${key}`);
    if (type) assignment(ctx, value, type, `${path}.${key}`, item);
    else valueType(ctx, value, `${path}.${key}`, item);
  }
}
function indexValue(ctx: ValidationContext, value: Extract<ActionStep, { op: 'state.update' }>['index'], path: string, item?: ItemContext) {
  assignment(ctx, value, { type: 'number' }, path, item);
  if (typeof value === 'number' && (!Number.isInteger(value) || value < 0)) {
    ctx.add('BAD_VALUE', path, 'Index must be a nonnegative integer.', 'Use 0, 1, …; check dynamic indices at runtime.');
  }
}
function ai(ctx: ValidationContext, step: Extract<ActionStep, { op: 'ai.run' }>, base: string, item?: ItemContext) {
  template(ctx, step.prompt, `${base}.prompt`, item);
  if (step.image !== undefined) assignment(ctx, step.image, { type: 'image' }, `${base}.image`, item);
  const target = ctx.state(step.into, `${base}.into`);
  if (target) {
    if (target.type !== step.output.type) expectType(ctx, step.output, target, `${base}.into`);
    else if (target.type === 'list' && step.output.type === 'list') {
      for (const [key, type] of Object.entries(step.output.of)) {
        if (!own(target.of, key) || target.of[key] !== type) {
          ctx.add('TYPE_MISMATCH', `${base}.output.of.${key}`, 'AI field is not compatible with the target list.', `Target fields: ${JSON.stringify(target.of)}.`);
        }
      }
    }
  }
  if (step.mode === 'append' && step.output.type !== 'list') {
    ctx.add('BAD_ACTION', `${base}.mode`, 'Append mode needs a list output.', 'Use replace for scalar output.');
  }
  if (step.defaults !== undefined) {
    if (step.output.type !== 'list' || (target && target.type !== 'list')) {
      ctx.add('BAD_ACTION', `${base}.defaults`, 'AI defaults are list-only.', 'Remove defaults for scalar output.');
    } else if (target?.type === 'list') for (const [key, value] of Object.entries(step.defaults)) {
      const type = field(ctx, target.of, key, `${base}.defaults.${key}`);
      if (type && !literalFits(value, type.type)) ctx.add('TYPE_MISMATCH', `${base}.defaults.${key}`,
        'AI default has the wrong type.', `Use a ${type.type} literal.`);
    }
  }
  if (step.flag !== undefined) {
    if (step.output.type !== 'list' || (target && target.type !== 'list')) {
      ctx.add('BAD_ACTION', `${base}.flag`, 'AI flag is list-only.', 'Remove flag for scalar output.');
    } else if (target?.type === 'list') {
      const type = field(ctx, target.of, step.flag, `${base}.flag`);
      if (type) expectType(ctx, type, { type: 'string' }, `${base}.flag`);
      if (own(step.output.of, step.flag) || (step.defaults && own(step.defaults, step.flag))) {
        ctx.add('BAD_ACTION', `${base}.flag`, 'The flag field cannot also be read by the AI or defaulted.', 'Use a separate string field.');
      }
    }
  }
  const state = Object.fromEntries(Object.entries(ctx.spec.state).map(([key, decl]) => [key, decl.default]));
  const decl = item ? ctx.spec.state[item.list] : undefined;
  const rows = decl?.type === 'list' && decl.default.length ? decl.default : [
    item ? Object.fromEntries(Object.entries(item.of).map(([key, type]) => [key,
      type === 'number' ? 0 : type === 'boolean' ? false : type === 'date' ? null : ''])) : undefined,
  ];
  rows.forEach((row, index) => {
    const expanded = resolveTemplate(step.prompt, { state, item: row, index: item ? index : undefined,
      now: new Date('2000-01-01T00:00:00Z'), locale: 'en-US', timeZone: 'UTC', currency: 'USD' });
    if (expanded.length > 2000) ctx.add('LIMIT_EXCEEDED', `${base}.prompt`, 'Expanded AI prompt exceeds 2000 characters.',
      'Shorten the prompt/default values. T-41 must also check live state, item and user settings immediately before inference.');
  });
}
function actionStep(ctx: ValidationContext, step: ActionStep, base: string, item?: ItemContext) {
  if ('path' in step) {
    const decl = ctx.state(step.path, `${base}.path`);
    if (step.op === 'state.set') {
      if (decl) assignment(ctx, step.value, decl, `${base}.value`, item);
      else valueType(ctx, step.value, `${base}.value`, item);
    }
    if (step.op === 'state.increment') {
      expectType(ctx, decl, { type: 'number' }, `${base}.path`);
      assignment(ctx, step.by, { type: 'number' }, `${base}.by`, item);
    }
    if (step.op === 'state.diff') {
      for (const [key, name, where] of [[step.path, step.path, 'path'], [step.from, step.from, 'from'], [step.without, step.without, 'without']] as const) {
        const list = where === 'path' ? decl : ctx.state(key, `${base}.${where}`);
        if (list?.type !== 'list' || list.of[step.field] !== 'string') {
          ctx.add('BAD_ACTION', `${base}.${where}`, `${name} must be a list with a string field “${step.field}”.`, `Declare ${name} as a list whose items have ${step.field}: string.`);
        }
      }
    }
    if (step.op === 'state.toggle') expectType(ctx, decl, { type: 'boolean' }, `${base}.path`);
    if (['state.append', 'state.update', 'state.remove'].includes(step.op)) {
      if (decl && decl.type !== 'list') expectType(ctx, decl, { type: 'list' }, `${base}.path`);
      if (decl?.type === 'list') {
        if (step.op === 'state.append') {
          patch(ctx, step.value, decl.of, `${base}.value`, true, item);
          for (const key of step.required ?? []) {
            if (field(ctx, decl.of, key, `${base}.required`)?.type !== 'string' && own(decl.of, key)) {
              ctx.add('BAD_ACTION', `${base}.required`, `Required field ${key} is not text.`, 'Only text fields can be required.');
            }
          }
        }
        if (step.op === 'state.update') patch(ctx, step.set, decl.of, `${base}.set`, false, item);
        if (step.op === 'state.remove' && step.where) where(ctx, step.where, decl.of, `${base}.where`);
      }
      if (step.op === 'state.update' || (step.op === 'state.remove' && step.index !== undefined)) {
        indexValue(ctx, step.index!, `${base}.index`, item);
      }
    }
  }
  if (step.op === 'navigate') ctx.reference('screens', step.screen, `${base}.screen`);
  if (step.op === 'ai.run') ai(ctx, step, base, item);
  if (step.op === 'confirm' || step.op === 'toast') template(ctx, step.message, `${base}.message`, item);
  if (step.op === 'share') template(ctx, step.text, `${base}.text`, item);
  if (step.op === 'notify') {
    template(ctx, step.title, `${base}.title`, item); template(ctx, step.body, `${base}.body`, item);
  }
}
export function actions(ctx: ValidationContext, callers: Callers, input: unknown) {
  if (!object(input)) return;
  for (const [id, action] of Object.entries(input)) {
    if (!IdentifierSchema.safeParse(id).success || !object(action) || !Array.isArray(action.steps)) continue;
    const contexts = callers.get(id) ?? [undefined];
    action.steps.forEach((step: unknown, i) => {
      const parsed = ActionStepSchema.safeParse(step);
      if (parsed.success) for (const item of contexts) actionStep(ctx, parsed.data, `actions.${id}.steps[${i}]`, item);
    });
  }
}
