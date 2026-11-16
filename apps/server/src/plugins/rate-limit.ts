import type { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

/**
 * Rate limiting por IP (CONTRATO §4):
 * - auth → 10 req / 5 min
 * - move → 120 req / min
 * - restante da API → 300 req / min
 * Plugin registrado com `global: false`: rotas sem `config.rateLimit`
 * (ex.: assets estáticos) não são limitadas.
 */

export const RATE_LIMITS = {
  auth: { max: 10, timeWindow: '5 minutes' },
  move: { max: 120, timeWindow: '1 minute' },
  default: { max: 300, timeWindow: '1 minute' },
} as const;

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: false,
    max: RATE_LIMITS.default.max,
    timeWindow: RATE_LIMITS.default.timeWindow,
    // O corpo precisa manter o status 429: um objeto simples perderia o
    // `statusCode` e o handler global responderia 500.
    errorResponseBuilder: () => {
      const error = new Error(
        'Muitas requisições. Tente novamente em instantes.',
      ) as Error & { statusCode: number; code: string };
      error.statusCode = 429;
      error.code = 'rate_limit';
      return error;
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
    },
  });
}
