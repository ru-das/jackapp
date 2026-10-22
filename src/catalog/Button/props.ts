import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const ButtonPropsSchema = z.strictObject({
  label: z.string(), onPress: IdentifierSchema, variant: z.enum(['primary', 'secondary', 'danger']).default('primary')
});
export type ButtonProps = z.infer<typeof ButtonPropsSchema>;
