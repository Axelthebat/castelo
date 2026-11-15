import type { FastifyInstance } from 'fastify';
import { registerErrorHandlers } from '../errors.ts';
import { requireCsrf } from '../lib/csrf.ts';
import { registerAuthRoutes } from '../routes/auth.ts';
import { registerUserRoutes } from '../routes/users.ts';
import { registerMiscRoutes } from '../routes/misc.ts';

/**
 * Registro das rotas `/api`. O hook de CSRF vale para todas as requisições
 * mutantes (POST/PUT/PATCH/DELETE); rotas públicas de auth não têm sessão e
 * por isso passam pelo hook, sendo validadas por requireAuth quando exigido.
 */
export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  registerErrorHandlers(app);

  await app.register(
    async (api) => {
      api.addHook('preHandler', requireCsrf);

      await api.register(registerAuthRoutes, { prefix: '/auth' });
      await api.register(registerUserRoutes, { prefix: '/users' });
      await api.register(registerMiscRoutes);
    },
    { prefix: '/api' },
  );
}
