import { z } from 'zod';
import { catalog } from '@/catalog';
import { ActionStepSchema, IdentifierSchema, OutputSchema, ValueSchema, WhereSchema } from '@/spec/schema';

const aliases = z.registry<{ id: string }>();
aliases.add(ValueSchema, { id: 'Value' });
aliases.add(IdentifierSchema, { id: 'Id' });
aliases.add(OutputSchema, { id: 'Output' });
aliases.add(WhereSchema, { id: 'Where' });

export function toPromptSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { io: 'input', reused: 'ref', metadata: aliases });
}

// Keep expressions named: expanding the bounded Value union overwhelms small contexts.
function describe(schema: z.core.JSONSchema.JSONSchema, definitions: Record<string, z.core.JSONSchema.JSONSchema> = {}): string {
  const render = (child: z.core.JSONSchema.JSONSchema) => describe(child, definitions);
  if (schema.$defs) definitions = { ...definitions, ...schema.$defs };
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop()!;
    return name.startsWith('__schema') ? describe(definitions[name], definitions) : name;
  }
  if (schema.default !== undefined) {
    const { default: fallback, ...rest } = schema;
    return describe(rest, definitions) + '=' + JSON.stringify(fallback);
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((item) => JSON.stringify(item)).join('|');
  if (schema.anyOf) return schema.anyOf.map(render).join('|');
  if (schema.oneOf) return schema.oneOf.map(render).join('|');
  if (schema.type === 'object') {
    if (schema.properties) return `{${Object.entries(schema.properties).map(([key, value]) =>
      `${key}${schema.required?.includes(key) ? '!' : '?'}:${render(value as z.core.JSONSchema.JSONSchema)}`).join(',')}}`;
    return `Record<string,${typeof schema.additionalProperties === 'object' ? render(schema.additionalProperties) : 'JSON'}>`;
  }
  if (schema.type === 'array') return `${typeof schema.items === 'object' && !Array.isArray(schema.items) ? render(schema.items) : 'JSON'}[]`;
  const type = Array.isArray(schema.type) ? schema.type.join('|') : schema.type ?? 'JSON';
  return type;
}

export function buildCatalogPrompt() {
  const components = Object.values(catalog).map(({ props, meta }) =>
    `${meta.name}: ${meta.hint} props ${describe(toPromptSchema(props))}; children:${meta.children ? 'yes' : 'no'}`);
  const ops = ActionStepSchema.options.map((schema) => describe(toPromptSchema(schema)));
  const text = [
    'Catalog (! required, ? optional; = default). Id: camelCase /^[a-z][a-zA-Z0-9]{0,31}$/; no unknown props.',
    ...components,
    'Ops: ' + ops.join('\n'),
    'Value = string (literal or Template) | number | boolean | {$ref:Path} | {$agg:{op:count|sum|avg|min|max,of:Id,field?:Id,where?:Where}} | {$math:[+|-|*|/|pow|min|max|round|days,Value,Value]} | {$now:true}. Math depth <=3; round third operand is digits; days = whole days from the first date to the second. Aggregate field required except count.',
    'Path = state key | $item.<field> | $index; item/index only inside List item context; no indexed paths such as items.0.name.',
    'Template = plain text with {{path}} or {{path|formatter}}; escape opener with \\{{. Formatters: count,date,time,ago,upper,lower,currency,fixed2.',
    'Where = {field:Id,equals:string|number|boolean|null}. state.remove requires exactly one of index or where.',
    'Output = {type:string|number|boolean|date|image} | {type:list,of:Record<Id,string|number|boolean|date>}. ai.run mode append only for lists; defaults fill missing list fields.',
  ].join('\n');
  return { text, chars: text.length, estimatedTokens: text.length / 4 };
}
