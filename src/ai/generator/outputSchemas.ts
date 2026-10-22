import { z } from 'zod';
import { catalog } from '@/catalog';
import { ActionStepSchema, FieldTypeSchema, IdentifierSchema, SpecSchema } from '@/spec/schema';
import { toPromptSchema } from './catalogPrompt';

export const UnsupportedSchema = z.strictObject({ unsupported: z.strictObject({
  reason: z.string().trim().min(1), missing: z.array(z.string().trim().min(1)).min(1),
  suggestion: z.string().trim().min(1),
}) });
export type Unsupported = z.infer<typeof UnsupportedSchema>['unsupported'];
export const ComponentSchema = z.enum(Object.keys(catalog) as [keyof typeof catalog, ...(keyof typeof catalog)[]]);
export const OpSchema = z.enum(ActionStepSchema.options.map((step) => step.shape.op.value) as
  [string, ...string[]]);
const purpose = { purpose: z.string() };
const PlanTriggerSchema = z.object({
  id: z.string(), type: z.literal('schedule'),
  schedule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('daily'), time: z.string() }),
    z.object({ kind: z.literal('weekly'), weekday: z.number(), time: z.string() }),
    z.object({ kind: z.literal('once'), at: z.string() }),
  ]),
  notify: z.object({ title: z.string(), body: z.string() }),
});
export const PlanSchema = z.object({
  name: z.string(), icon: z.string(), summary: z.string(),
  state: z.array(z.object({ key: z.string(), type: z.enum(['string', 'number', 'boolean', 'date', 'image', 'list']),
    of: z.record(z.string(), FieldTypeSchema).optional(), ...purpose })),
  screens: z.array(z.object({ id: z.string(), ...purpose })),
  components: z.array(z.object({ type: ComponentSchema, bind: z.string().optional(), ...purpose })),
  actions: z.array(z.object({ id: z.string(), ops: z.array(OpSchema), ...purpose })),
  triggers: z.array(PlanTriggerSchema), unsupported: z.null(),
});
export type Plan = z.infer<typeof PlanSchema>;
export type TargetStage = 'plan' | 'spec';

// Constrain props to the actual registry; semantic validation still checks the graph.
const elements = Object.entries(catalog).map(([name, { props, meta }]) => z.strictObject({
  type: z.literal(name), props,
  ...(meta.children ? { children: z.array(z.string()).optional() } : {}),
}));
const GenerationSpecSchema = SpecSchema.extend({
  elements: z.record(IdentifierSchema, z.union([elements[0], elements[1], ...elements.slice(2)])),
});

export function outputSchema(target: TargetStage) {
  return toPromptSchema(z.union([target === 'plan' ? PlanSchema : GenerationSpecSchema, UnsupportedSchema]));
}
