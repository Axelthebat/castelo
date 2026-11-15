import type { FastifyInstance } from 'fastify';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '@castelo/shared';
import { getDb } from '../db/index.ts';
import { HttpError } from '../errors.ts';
import { parseBody } from '../lib/validate.ts';
import { hashPassword, verifyPassword } from '../lib/password.ts';
import { randomToken } from '../lib/ids.ts';
import { HOUR_MS, isoAfter, nowIso } from '../lib/time.ts';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSession,
  setSessionCookie,
  sha256Hex,
} from '../lib/session.ts';
import { requireAuth } from '../plugins/auth.ts';
import { RATE_LIMITS } from '../plugins/rate-limit.ts';
import { getUserStats, toPublicUser } from '../repos/games.ts';
import {
  consumePasswordReset,
  createPasswordReset,
  createUser,
  findPasswordReset,
  findUserByEmail,
  findUserByIdentifier,
  findUserByUsername,
  updateUserPassword,
} from '../repos/users.ts';
import { deleteSessionsForUser } from '../repos/sessions.ts';

/**
 * Rotas de autenticação (CONTRATO §4).
 * CSRF é aplicado globalmente pelo plugin de rotas; estas rotas são públicas.
 */

// Hash válido de scrypt usado quando o identificador não existe, para que o
// tempo de resposta não revela se o usuário existe (login timing oracle).
const DUMMY_HASH =
  'scrypt$32768$8$1$xXeDgwNYPKYRMtetltyZ7A==$U9kaFhwz0KL+bo7lMGUcnNyumTkCdOCLrJlJqMbOObGy77k9aUiwFeLT35a1X9oODRT65LUACwKU+pf3PThwFA==';

function sessionMeta(req: { headers: Record<string, string | string[] | undefined>; ip?: string }) {
  const ua = req.headers['user-agent'];
  return {
    userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null,
    ip: req.ip ?? null,
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', { config: { rateLimit: RATE_LIMITS.auth } }, async (req, reply) => {
    const db = getDb();
    const data = parseBody(registerSchema, req.body);

    if (findUserByUsername(db, data.username) || findUserByEmail(db, data.email)) {
      throw new HttpError(409, 'conflict', 'Nome de usuário ou e-mail já está em uso');
    }

    const user = createUser(db, {
      username: data.username,
      email: data.email,
      passwordHash: hashPassword(data.password),
    });
    const created = createSession(db, { userId: user.id, ...sessionMeta(req), remember: true });
    setSessionCookie(reply, created.token, true);

    return reply.code(201).send({
      user: toPublicUser(user, getUserStats(db, user.id)),
      token: created.token,
      csrfToken: created.csrfToken,
    });
  });

  app.post('/login', { config: { rateLimit: RATE_LIMITS.auth } }, async (req, reply) => {
    const db = getDb();
    const data = parseBody(loginSchema, req.body);

    const user = findUserByIdentifier(db, data.identifier);
    const passwordOk = verifyPassword(data.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      throw new HttpError(401, 'credentials', 'Usuário ou senha inválidos');
    }

    const created = createSession(db, { userId: user.id, ...sessionMeta(req), remember: data.remember });
    setSessionCookie(reply, created.token, data.remember);

    return reply.send({
      user: toPublicUser(user, getUserStats(db, user.id)),
      token: created.token,
      csrfToken: created.csrfToken,
    });
  });

  app.post('/logout', { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.auth } }, async (req, reply) => {
    const db = getDb();
    destroySession(req, db);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: [requireAuth], config: { rateLimit: RATE_LIMITS.auth } }, async (req) => {
    const db = getDb();
    const user = req.currentUser!;
    const found = getSession(req, db);
    return {
      user: toPublicUser(user, getUserStats(db, user.id)),
      csrfToken: found?.session.csrf_token ?? '',
    };
  });

  app.post('/forgot', { config: { rateLimit: RATE_LIMITS.auth } }, async (req, reply) => {
    const db = getDb();
    const data = parseBody(forgotPasswordSchema, req.body);
    const user = findUserByEmail(db, data.email);
    if (user) {
      const token = randomToken(32);
      createPasswordReset(db, {
        userId: user.id,
        tokenHash: sha256Hex(token),
        expiresAt: isoAfter(HOUR_MS),
      });
      // Sem envio de e-mail nesta fase: o token é descartado (nunca logado).
    }
    // Sempre 200 — não revela se o e-mail existe.
    return reply.send({ ok: true });
  });

  app.post('/reset', { config: { rateLimit: RATE_LIMITS.auth } }, async (req, reply) => {
    const db = getDb();
    const data = parseBody(resetPasswordSchema, req.body);
    const reset = findPasswordReset(db, sha256Hex(data.token));

    if (!reset || reset.used_at !== null || reset.expires_at <= nowIso()) {
      throw new HttpError(400, 'invalid_token', 'Token inválido ou expirado');
    }

    updateUserPassword(db, reset.user_id, hashPassword(data.password));
    consumePasswordReset(db, reset.id, nowIso());
    deleteSessionsForUser(db, reset.user_id);

    return reply.send({ ok: true });
  });
}
