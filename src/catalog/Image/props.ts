import { z } from 'zod';
import { ValueSchema } from '@/spec/schema';

export const ImagePropsSchema = z.strictObject({
  src: ValueSchema, aspect: z.enum(['square', 'wide', 'tall']).default('wide'), alt: z.string().default('')
});
export type ImageProps = z.infer<typeof ImagePropsSchema>;
