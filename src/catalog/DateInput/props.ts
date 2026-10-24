import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

// `mode` is date only for now: time-of-day and date-time need a native picker (a new dependency and a rebuild), see COMPONENTS.md.
export const DateInputPropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string(), mode: z.enum(['date']).default('date'),
});
export type DateInputProps = z.infer<typeof DateInputPropsSchema>;
