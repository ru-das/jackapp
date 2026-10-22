import { z } from 'zod';
import { catalog } from '@/catalog';
import { ActionSchema, ElementSchema, IdentifierSchema, ScreenSchema, SpecSchema, StateDeclSchema, TriggerSchema } from './schema';
import type { ErrorCode, Spec } from './types';
import { at, own, type AddError } from './validation-context';

export const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function codeFor(path: PropertyKey[], message: string): ErrorCode {
  if (path[0] === 'specVersion') return 'BAD_VERSION';
  if ((path.length === 1 && ['state', 'elements', 'actions', 'screens', 'triggers'].includes(String(path[0]))
      && (/At most/.test(message) || /Too big/.test(message)))
    || (/At most 8 list fields/.test(message))
    || (path[0] === 'actions' && path[2] === 'steps' && path.length === 3 && /Too big/.test(message))) return 'LIMIT_EXCEEDED';
  if (path[0] === 'elements' && path[2] === 'type') return 'UNKNOWN_COMPONENT';
  if (path[0] === 'elements' && path[2] === 'children') return 'TREE';
  if (path[0] === 'actions' && path[2] === 'steps' && typeof path[3] === 'number') {
    if (['value', 'set', 'index', 'by', 'image'].includes(String(path[4]))) return 'BAD_VALUE';
    return 'BAD_ACTION';
  }
  return 'SHAPE';
}
export function issues(error: z.ZodError, add: AddError, prefix: PropertyKey[] = [], override?: ErrorCode) {
  for (const issue of error.issues) {
    const path = [...prefix, ...issue.path];
    const paths = issue.code === 'unrecognized_keys' ? issue.keys.map((key) => [...path, key]) : [path];
    for (const parts of paths) {
      const code = override ?? codeFor(parts, issue.message);
      const hints: Partial<Record<ErrorCode, string>> = {
        BAD_VERSION: 'Use specVersion "0.1".',
        UNKNOWN_COMPONENT: `Valid components: ${Object.keys(catalog).join(', ')}. P1 components are deferred.`,
        BAD_VALUE: 'Use a literal, $ref, $agg, $now, or $math (maximum 3 nested math nodes). Paths: state key, $item.field or $index.',
        BAD_ACTION: 'Valid operations: state.set, state.append, state.update, state.remove, state.toggle, state.increment, state.reset, ai.run, navigate, confirm, toast, notify, share. Match their fields in SCHEMA §7.',
        LIMIT_EXCEEDED: 'Limits: 3 screens, 60 elements, 20 state keys, 8 list fields, 12 actions, 8 steps per action, 3 triggers.',
        TREE: 'Only Stack and Card accept children; use each element exactly once.',
      };
      add(code, at(parts), issue.message, hints[code] ?? 'Match the strict v0.1 schema; remove unknown properties and supply required fields.');
    }
  }
}
function mapEntries<T>(raw: unknown, schema: z.ZodType<T>): Record<string, T> {
  if (!object(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => {
    const parsed = schema.safeParse(value);
    return IdentifierSchema.safeParse(key).success && parsed.success ? [[key, parsed.data]] : [];
  }));
}
function arrayEntries<T>(raw: unknown, schema: z.ZodType<T>): T[] {
  return Array.isArray(raw) ? raw.flatMap((value) => {
    const parsed = schema.safeParse(value); return parsed.success ? [parsed.data] : [];
  }) : [];
}
// Keep independently valid sections available for semantic checks after a structural failure.
export function structure(raw: Record<string, unknown>, add: AddError): { spec: Spec; graphValid: boolean } {
  const parsed = SpecSchema.safeParse(raw);
  if (parsed.success) return { spec: parsed.data, graphValid: true };
  issues(parsed.error, add);
  return { spec: {
    specVersion: '0.1', meta: { name: '', description: '', icon: '🧊' },
    state: mapEntries(raw.state, StateDeclSchema), elements: mapEntries(raw.elements, ElementSchema),
    actions: mapEntries(raw.actions, ActionSchema), screens: arrayEntries(raw.screens, ScreenSchema),
    triggers: arrayEntries(raw.triggers, TriggerSchema),
  }, graphValid: !parsed.error.issues.some((issue) => ['screens', 'elements'].includes(String(issue.path[0]))
    && !(issue.path[0] === 'elements' && issue.path[2] === 'props')) };
}
export function props(spec: Spec, add: AddError): Set<string> {
  const invalid = new Set<string>();
  for (const [id, element] of Object.entries(spec.elements)) {
    if (!own(catalog, element.type)) {
      add('UNKNOWN_COMPONENT', `elements.${id}.type`, 'This component is not implemented.', `Valid components: ${Object.keys(catalog).join(', ')}.`);
      invalid.add(id); continue;
    }
    const parsed = catalog[element.type as keyof typeof catalog].props.safeParse(element.props);
    if (!parsed.success) {
      invalid.add(id);
      for (const issue of parsed.error.issues) {
        const value = (element.type === 'Stat' && issue.path[0] === 'value') || (element.type === 'Image' && issue.path[0] === 'src');
        const reported = value && issue.code !== 'unrecognized_keys' ? { ...issue, path: issue.path.slice(0, 1) } : issue;
        issues(new z.ZodError([reported]), (code, path, message, hint) => add(code, path, message,
          value ? hint : `Valid ${element.type} props: ${Object.keys(catalog[element.type as keyof typeof catalog].props.shape).join(', ') || '(none)'}. ${hint}`),
        ['elements', id, 'props'], value ? 'BAD_VALUE' : 'BAD_PROP');
      }
    }
  }
  return invalid;
}
