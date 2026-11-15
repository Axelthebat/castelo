import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SessionRow } from '../repos/sessions.ts';
import type { UserRow } from '../repos/users.ts';
import { HttpError } from '../errors.ts';
import { getSession } from '../lib/session.ts';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: UserRow;
    currentSession?: SessionRow;
  }
}

/** preHandler: exige sessão válida e anexa usuário/sessão à requisição. */
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const found = getSession(req);
  if (!found) {
    throw new HttpError(401, 'unauthorized', 'Autentique-se para continuar');
  }
  req.currentUser = found.user;
  req.currentSession = found.session;
}
