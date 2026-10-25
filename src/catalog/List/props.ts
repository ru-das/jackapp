import { z } from 'zod';
import { IdentifierSchema } from '@/spec/schema';

export const ListPropsSchema = z.strictObject({
  items: IdentifierSchema, title: z.string(), subtitle: z.string().optional(), trailing: z.string().optional(), flagField: IdentifierSchema.optional(), checkField: IdentifierSchema.optional(), deletable: z.boolean().default(false), onItemPress: IdentifierSchema.optional(), sort: z.strictObject({ field: IdentifierSchema, dir: z.enum(['asc', 'desc']) }).optional(), emptyText: z.string().default('Nothing here yet')
});
export type ListProps = z.infer<typeof ListPropsSchema>;
