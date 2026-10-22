import type { SpecError } from '@/spec/types';
import { PlanSchema } from './outputSchemas';

export function schemaErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): SpecError[] {
  return error.issues.map((issue) => ({
    code: 'SHAPE', path: issue.path.reduce<string>((path, key) =>
      typeof key === 'number' ? `${path}[${key}]` : `${path}${path ? '.' : ''}${String(key)}`, ''),
    message: issue.message, hint: 'Use the target schema field types and registered component/op names.',
  }));
}

export function validatePlan(input: unknown): SpecError[] {
  const result = PlanSchema.safeParse(input);
  return result.success ? [] : schemaErrors(result.error);
}
