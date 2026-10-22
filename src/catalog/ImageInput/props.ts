import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const ImageInputPropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string(), source: z.enum(['camera', 'library', 'any']).default('any')
});
export type ImageInputProps = z.infer<typeof ImageInputPropsSchema>;
