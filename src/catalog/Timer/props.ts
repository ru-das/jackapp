import { z } from 'zod';
import { IdentifierSchema, ValueSchema } from '@/spec/schema';

export const TimerPropsSchema = z.strictObject({
  seconds: ValueSchema, label: z.string(), onDone: IdentifierSchema.optional(), notify: z.boolean().default(true),
});
export type TimerProps = z.infer<typeof TimerPropsSchema>;
