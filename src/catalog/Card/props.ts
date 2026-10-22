import { z } from 'zod';

export const CardPropsSchema = z.strictObject({
  title: z.string().optional(), subtitle: z.string().optional()
});
export type CardProps = z.infer<typeof CardPropsSchema>;
