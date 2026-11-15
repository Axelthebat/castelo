import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Configuração do servidor.
 *
 * Regras (CONTRATO §7):
 * - valores de desenvolvimento têm default em código;
 * - em produção, SESSION_SECRET é obrigatório;
 * - segredos nunca são logados.
 */

export const DEV_SESSION_SECRET = 'castelo-dev-insecure-secret';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const defaultDatabasePath = fileURLToPath(new URL('../data/castelo.db', import.meta.url));

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_PATH: z.string().min(1).default(defaultDatabasePath),
  NODE_ENV: nodeEnvSchema.default('development'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 365).default(24),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema> & {
  /** Sempre presente: em produção vem do ambiente, em dev/test é o valor dev. */
  SESSION_SECRET: string;
};

function resolveSecret(nodeEnv: z.infer<typeof nodeEnvSchema>, raw: string | undefined): string {
  if (raw && raw.length >= 16) return raw;
  if (nodeEnv === 'production') {
    throw new Error('SESSION_SECRET é obrigatório quando NODE_ENV=production');
  }
  return DEV_SESSION_SECRET;
}

export function loadEnv(): Env {
  const parsed = envSchema.parse(process.env);
  return {
    ...parsed,
    SESSION_SECRET: resolveSecret(parsed.NODE_ENV, parsed.SESSION_SECRET),
  };
}

let cached: Env | null = null;

/** Configuração memoizada — use loadEnv() para reler o ambiente (tests/boot). */
export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}
