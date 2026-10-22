import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const TextInputPropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string(), placeholder: z.string().optional(), multiline: z.boolean().default(false), onSubmit: IdentifierSchema.optional()
});
export type TextInputProps = z.infer<typeof TextInputPropsSchema>;
