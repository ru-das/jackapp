import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const SelectPropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string(), options: z.array(z.string()).min(2).max(12)
});
export type SelectProps = z.infer<typeof SelectPropsSchema>;
