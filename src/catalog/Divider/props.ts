import { z } from 'zod';

export const DividerPropsSchema = z.strictObject({
  
});
export type DividerProps = z.infer<typeof DividerPropsSchema>;
