import { z } from 'zod';
import { ValueSchema } from '@/spec/schema';

export const StatPropsSchema = z.strictObject({
  label: z.string(), value: ValueSchema, format: z.enum(['number', 'currency', 'percent', 'date', 'ago', 'text']).default('number')
});
export type StatProps = z.infer<typeof StatPropsSchema>;
