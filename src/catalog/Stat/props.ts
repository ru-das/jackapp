import { z } from 'zod';
import { ValueSchema } from '@/spec/schema';

export const StatPropsSchema = z.strictObject({
  label: z.string(), value: ValueSchema, format: z.enum(['number', 'currency', 'percent', 'date', 'ago', 'text']).default('number'),
  // ISO code, usually a template over a Select; an unknown code falls back to the app default.
  currency: z.string().optional(),
});
export type StatProps = z.infer<typeof StatPropsSchema>;
