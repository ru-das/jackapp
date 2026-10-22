import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const NumberInputPropsSchema = z.strictObject({
  bind: IdentifierSchema, label: z.string(), min: z.number().optional(), max: z.number().optional(), step: z.number().default(1), mode: z.enum(['field', 'stepper', 'slider']).default('stepper')
}).superRefine((props, ctx) => {
  if (props.mode === 'slider') {
    for (const key of ['min', 'max'] as const) {
      if (props[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: 'Slider requires '+key });
    }
  }
});
export type NumberInputProps = z.infer<typeof NumberInputPropsSchema>;
