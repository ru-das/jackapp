import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const TogglePropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string()
});
export type ToggleProps = z.infer<typeof TogglePropsSchema>;
