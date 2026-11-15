import type { ZodType } from 'zod';
import { HttpError } from '../errors.ts';

/**
 * Validação de entrada no servidor com zod (CONTRATO §7).
 * Em falha: 400 `{ error: { code: 'validation', message, fields } }`.
 */
export function issueFields(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fields = issueFields(result.error.issues);
    const message = result.error.issues[0]?.message ?? 'Dados inválidos';
    throw new HttpError(400, 'validation', message, fields);
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    const fields = issueFields(result.error.issues);
    const message = result.error.issues[0]?.message ?? 'Parâmetros inválidos';
    throw new HttpError(400, 'validation', message, fields);
  }
  return result.data;
}
