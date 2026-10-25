import { z } from 'zod';

export const IdentifierSchema = z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/);
export const PathSchema = z.string().regex(/^(?:[a-z][a-zA-Z0-9]{0,31}|\$index|\$item\.[a-z][a-zA-Z0-9]{0,31})$/);
export const IsoDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const FieldTypeSchema = z.enum(['string', 'number', 'boolean', 'date']);
export const ListFieldsSchema = z.record(IdentifierSchema, FieldTypeSchema)
  .refine((fields) => Object.keys(fields).length <= 8, 'At most 8 list fields');
export const OutputSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('string') }),
  z.strictObject({ type: z.literal('number') }),
  z.strictObject({ type: z.literal('boolean') }),
  z.strictObject({ type: z.literal('date') }),
  z.strictObject({ type: z.literal('image') }),
  z.strictObject({ type: z.literal('list'), of: ListFieldsSchema }),
]);
const fieldSchemas = {
  string: z.string(), number: z.number(), boolean: z.boolean(), date: IsoDateSchema.nullable(),
};
export const StateDeclSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('string'), default: z.string(), persist: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('number'), default: z.number(), persist: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('boolean'), default: z.boolean(), persist: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('date'), default: IsoDateSchema.nullable(), persist: z.boolean().default(true) }),
  z.strictObject({ type: z.literal('image'), default: z.string().regex(/^(?:data:image\/|file:\/\/)/).nullable(), persist: z.boolean().default(true) }),
  z.strictObject({
    type: z.literal('list'), of: ListFieldsSchema,
    default: z.array(z.record(IdentifierSchema, scalar)).default([]), persist: z.boolean().default(true),
  }).superRefine((decl, ctx) => {
    const itemSchema = z.strictObject(Object.fromEntries(
      Object.entries(decl.of).map(([key, type]) => [key, fieldSchemas[type]]),
    ));
    decl.default.forEach((item, index) => {
      const result = itemSchema.safeParse(item);
      if (!result.success) result.error.issues.forEach((issue) => {
        const paths = issue.code === 'unrecognized_keys' ? issue.keys.map((key) => [...issue.path, key]) : [issue.path];
        paths.forEach((path) => ctx.addIssue({ code: 'custom', path: ['default', index, ...path], message: issue.message }));
      });
    });
  }),
]);
export const WhereSchema = z.strictObject({ field: IdentifierSchema, equals: scalar });
export const RefSchema = z.strictObject({ $ref: PathSchema });
export const AggregateSchema = z.strictObject({
  $agg: z.union([
    z.strictObject({ op: z.literal('count'), of: IdentifierSchema, field: IdentifierSchema.optional(), where: WhereSchema.optional() }),
    z.strictObject({ op: z.enum(['sum', 'avg', 'min', 'max']), of: IdentifierSchema, field: IdentifierSchema, where: WhereSchema.optional() }),
  ]),
});
export const NowSchema = z.strictObject({ $now: z.literal(true) });
export const MathOperatorSchema = z.enum(['+', '-', '*', '/', 'round', 'pow', 'min', 'max', 'days']);
type RecursiveValue = string | number | boolean | z.infer<typeof RefSchema>
  | z.infer<typeof AggregateSchema> | z.infer<typeof NowSchema>
  | { $math: [z.infer<typeof MathOperatorSchema>, RecursiveValue, RecursiveValue] };

// Building a bounded schema also prevents parsing an arbitrarily deep expression.
function valueSchema(depth: number): z.ZodType<RecursiveValue> {
  const base = [z.string(), z.number(), z.boolean(), RefSchema, AggregateSchema, NowSchema] as const;
  if (depth === 0) return z.union(base);
  const operand = valueSchema(depth - 1);
  return z.union([...base, z.strictObject({ $math: z.tuple([MathOperatorSchema, operand, operand]) })]);
}
export const ValueSchema = valueSchema(3);
export const MathSchema = z.strictObject({
  $math: z.tuple([MathOperatorSchema, valueSchema(2), valueSchema(2)]),
});
export const MetaSchema = z.strictObject({
  name: z.string().min(1).max(40), description: z.string().max(140),
  icon: z.string().regex(/^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)$/u),
  sourcePrompt: z.string().optional(),
  generatedBy: z.strictObject({ provider: z.enum(['mock', 'local', 'openrouter', 'ollama']), model: z.string() }).optional(),
});
export const ScreenSchema = z.strictObject({ id: IdentifierSchema, title: z.string(), root: IdentifierSchema });
export const ComponentNameSchema = z.enum([
  'Stack', 'Card', 'Divider', 'Text', 'Image', 'Stat', 'TextInput', 'NumberInput',
  'Toggle', 'Select', 'ImageInput', 'DateInput', 'List', 'Button', 'Timer', 'Chart',
]);
export const ElementSchema = z.strictObject({
  type: ComponentNameSchema,
  // Structure accepts JSON props; validate() applies the renderer-free catalog schemas.
  props: z.record(z.string(), z.json()),
  children: z.array(IdentifierSchema).optional(),
}).refine((element) => element.children === undefined || ['Stack', 'Card'].includes(element.type), {
  path: ['children'], message: 'Only Stack and Card accept children',
});
const valueMap = z.record(IdentifierSchema, ValueSchema);
export const ActionStepSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('state.set'), path: IdentifierSchema, value: ValueSchema }),
  z.strictObject({ op: z.literal('state.append'), path: IdentifierSchema, value: valueMap, required: z.array(IdentifierSchema).max(8).optional() }),
  z.strictObject({ op: z.literal('state.update'), path: IdentifierSchema, index: ValueSchema, set: valueMap }),
  z.strictObject({ op: z.literal('state.remove'), path: IdentifierSchema, index: ValueSchema.optional(), where: WhereSchema.optional() })
    .refine((step) => (step.index !== undefined) !== (step.where !== undefined), 'Provide exactly one of index or where'),
  z.strictObject({ op: z.literal('state.toggle'), path: IdentifierSchema }),
  z.strictObject({ op: z.literal('state.increment'), path: IdentifierSchema, by: ValueSchema.default(1) }),
  z.strictObject({ op: z.literal('state.reset'), path: IdentifierSchema }),
  z.strictObject({ op: z.literal('state.diff'), path: IdentifierSchema, from: IdentifierSchema, without: IdentifierSchema, field: IdentifierSchema }),
  z.strictObject({ op: z.literal('ai.run'), prompt: z.string(), image: ValueSchema.optional(), output: OutputSchema,
    into: IdentifierSchema, mode: z.enum(['replace', 'append']).default('replace'), defaults: z.record(IdentifierSchema, scalar).optional(), flag: IdentifierSchema.optional() }),
  z.strictObject({ op: z.literal('navigate'), screen: IdentifierSchema }),
  z.strictObject({ op: z.literal('confirm'), message: z.string() }),
  z.strictObject({ op: z.literal('toast'), message: z.string() }),
  z.strictObject({ op: z.literal('notify'), title: z.string(), body: z.string() }),
  z.strictObject({ op: z.literal('share'), text: z.string() }),
]);
export const ActionSchema = z.strictObject({ steps: z.array(ActionStepSchema).max(8) });
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const ScheduleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('daily'), time }),
  z.strictObject({ kind: z.literal('weekly'), weekday: z.number().int().min(0).max(6), time }),
  z.strictObject({ kind: z.literal('once'), at: IsoDateSchema }),
]);
export const TriggerSchema = z.strictObject({
  id: IdentifierSchema, type: z.literal('schedule'), schedule: ScheduleSchema,
  notify: z.strictObject({ title: z.string(), body: z.string() }),
});
function limitedMap<T extends z.ZodType>(schema: T, max: number) {
  return z.record(IdentifierSchema, schema).refine((map) => Object.keys(map).length <= max, `At most ${max} entries`);
}
export const SpecSchema = z.strictObject({
  specVersion: z.literal('0.1'), meta: MetaSchema, state: limitedMap(StateDeclSchema, 20),
  screens: z.array(ScreenSchema).min(1).max(3), elements: limitedMap(ElementSchema, 60),
  actions: limitedMap(ActionSchema, 12), triggers: z.array(TriggerSchema).max(3).optional(),
});
