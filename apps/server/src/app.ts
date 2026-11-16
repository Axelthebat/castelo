import Fastify, { type FastifyInstance } from 'fastify';
import { registerSecurity } from './plugins/security.ts';
import { registerRateLimit, RATE_LIMITS } from './plugins/rate-limit.ts';
import { registerApiRoutes } from './plugins/routes.ts';
import { registerGamesRoutes } from './routes/games.ts';
import { registerSocialRoutes } from './routes/social.ts';
import { getEnv, isProduction } from './env.ts';

/**
 * Monta a instância do Fastify.
 *
 * Ordem das camadas:
 *  1. segurança (helmet/cookie/CORS)
 *  2. rate limiting (padrão aplicado às rotas /api sem limite próprio)
 *  3. rotas da API (auth, users, misc, games, social)
 */
export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();

  const app = Fastify({
    logger: {
      level: isProduction() ? 'info' : 'warn',
    },
    trustProxy: true,
    bodyLimit: 256 * 1024,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: true } },
  });

  await registerSecurity(app);
  await registerRateLimit(app);

  // Limite padrão para toda rota /api que não declare um limite próprio.
  app.addHook('onRoute', (routeOptions) => {
    if (!routeOptions.url?.startsWith('/api')) return;
    if (routeOptions.config?.rateLimit) return;
    routeOptions.config = { ...routeOptions.config, rateLimit: RATE_LIMITS.default };
  });

  await registerApiRoutes(app);
  await app.register(registerGamesRoutes);
  await app.register(registerSocialRoutes);

  app.get('/api/health', async () => ({
    status: 'ok',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  }));

  return app;
}
