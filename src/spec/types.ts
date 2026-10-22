import type { z } from 'zod';
import type {
  ActionSchema, ActionStepSchema, AggregateSchema, ComponentNameSchema, ElementSchema,
  ListFieldsSchema, MetaSchema, OutputSchema, ScheduleSchema, ScreenSchema, SpecSchema,
  StateDeclSchema, TriggerSchema, ValueSchema, WhereSchema,
} from './schema';

export type Spec = z.infer<typeof SpecSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type StateDecl = z.infer<typeof StateDeclSchema>;
export type ListFields = z.infer<typeof ListFieldsSchema>;
export type Value = z.infer<typeof ValueSchema>;
export type Aggregate = z.infer<typeof AggregateSchema>['$agg'];
export type Where = z.infer<typeof WhereSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type ComponentName = z.infer<typeof ComponentNameSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type ActionStep = z.infer<typeof ActionStepSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type Trigger = z.infer<typeof TriggerSchema>;

export type ErrorCode = 'BAD_JSON' | 'BAD_VERSION' | 'SHAPE' | 'UNKNOWN_COMPONENT'
  | 'BAD_PROP' | 'MISSING_REF' | 'UNDECLARED_STATE' | 'TYPE_MISMATCH' | 'TREE'
  | 'BAD_VALUE' | 'BAD_ACTION' | 'LIMIT_EXCEEDED';
export type SpecError = { code: ErrorCode; path: string; message: string; hint?: string };
