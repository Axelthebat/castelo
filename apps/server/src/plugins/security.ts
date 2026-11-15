import type { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { getEnv, isDevelopment } from '../env.ts';

/**
 * Segurança HTTP: helmet (CSP), cookie e CORS.
 * - CSP em desenvolvimento libera apenas o Vite dev server (APP_ORIGIN) e o
 *   WebSocket de HMR; em produção é restritiva.
 * - CORS só em desenvolvimento, com credenciais.
 */
export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const env = getEnv();

  const directives: Record<string, string[]> = isDevelopment()
    ? {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", env.APP_ORIGIN],
        styleSrc: ["'self'", "'unsafe-inline'", env.APP_ORIGIN],
        imgSrc: ["'self'", 'data:', env.APP_ORIGIN],
        connectSrc: ["'self'", env.APP_ORIGIN, `ws://${new URL(env.APP_ORIGIN).host}`],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      }
    : {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      };

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: { useDefaults: false, directives },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(fastifyCookie);

  if (isDevelopment()) {
    await app.register(fastifyCors, {
      origin: env.APP_ORIGIN,
      credentials: true,
    });
  }
}
