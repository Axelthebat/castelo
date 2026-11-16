import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../errors.ts';
import { csrfMatches, getSession } from './session.ts';

/**
 * CSRF double-submit: toda requisição mutante exige o header `X-CSRF-Token`
 * com o mesmo valor do `csrf_token` da sessão. Sem sessão (rotas públicas de
 * auth) o hook não bloqueia — o `requireAuth` cuida das rotas que exigem login.
 */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const CSRF_ERROR_MESSAGE = 'Sessão inválida. Recarregue a página.';

export async function requireCsrf(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!MUTATING.has(req.method)) return;

  const found = getSession(req);
  if (!found) return; // rota pública (login/register/forgot/reset)

  const header = req.headers['x-csrf-token'];
  const provided = typeof header === 'string' ? header : '';
  if (!csrfMatches(provided, found.session.csrf_token)) {
    throw new HttpError(403, 'csrf', CSRF_ERROR_MESSAGE);
  }
}
