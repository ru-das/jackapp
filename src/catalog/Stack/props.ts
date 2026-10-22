import { z } from 'zod';

export const StackPropsSchema = z.strictObject({
  direction: z.enum(['vertical', 'horizontal']).default('vertical'), gap: z.enum(['none', 'sm', 'md', 'lg']).default('md'), align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'), wrap: z.boolean().default(false)
});
export type StackProps = z.infer<typeof StackPropsSchema>;
