import { z } from 'zod';

export const TextPropsSchema = z.strictObject({
  value: z.string(), variant: z.enum(['title', 'heading', 'body', 'caption', 'muted']).default('body')
});
export type TextProps = z.infer<typeof TextPropsSchema>;
