import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.ts';
import { parseBody } from '../lib/validate.ts';
import { requireAuth } from '../plugins/auth.ts';
import { requireCsrf } from '../lib/csrf.ts';
import { getDb } from '../db/index.ts';
import {
  acceptFriendRequest,
  createFriendRequest,
  listFriends,
  removeFriendship,
} from '../repos/friends.ts';
import { findUserByUsername } from '../repos/users.ts';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';

const requestSchema = z.object({
  username: z.string().trim().min(3).max(20),
});

const challengeSchema = z.object({
  username: z.string().trim().min(3).max(20),
  timeControl: z.string().regex(/^\d+\+\d+$/),
});

const idParams = z.object({ id: z.string().min(1).max(64) });

function currentUser(req: FastifyRequest) {
  if (!req.currentUser) throw new HttpError(401, 'unauthorized', 'Autentique-se para continuar');
  return req.currentUser;
}

export async function registerSocialRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/friends', { preHandler: [requireAuth] }, async (req) => {
    const user = currentUser(req);
    return { friends: listFriends(getDb(), user.id) };
  });

  app.post('/api/friends/request', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const user = currentUser(req);
    const payload = parseBody(requestSchema, req.body);
    const db = getDb();

    const target = findUserByUsername(db, payload.username);
    if (!target) {
      throw new HttpError(404, 'not-found', 'Jogador não encontrado.');
    }
    if (target.id === user.id) {
      throw new HttpError(400, 'validation', 'Você não pode adicionar a si mesmo.');
    }

    try {
      createFriendRequest(db, user.id, target.id);
    } catch (error) {
      throw new HttpError(409, 'conflict', (error as Error).message);
    }

    return { ok: true };
  });

  app.post<{ Params: { id: string } }>(
    '/api/friends/:id/accept',
    { preHandler: [requireAuth, requireCsrf] },
    async (req) => {
      const user = currentUser(req);
      const { id } = idParams.parse(req.params);
      const accepted = acceptFriendRequest(getDb(), id, user.id);
      if (!accepted) {
        throw new HttpError(404, 'not-found', 'Pedido não encontrado ou já tratado.');
      }
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/friends/:id',
    { preHandler: [requireAuth, requireCsrf] },
    async (req) => {
      const user = currentUser(req);
      const { id } = idParams.parse(req.params);
      const removed = removeFriendship(getDb(), id, user.id);
      if (!removed) throw new HttpError(404, 'not-found', 'Pedido não encontrado.');
      return { ok: true };
    },
  );

  app.post('/api/challenges', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const user = currentUser(req);
    const payload = parseBody(challengeSchema, req.body);
    const db = getDb();

    const target = findUserByUsername(db, payload.username);
    if (!target) throw new HttpError(404, 'not-found', 'Jogador não encontrado.');

    const id = newId();
    db.prepare(
      `INSERT INTO friends_challenges (id, from_id, to_id, time_control, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    ).run(id, user.id, target.id, payload.timeControl, nowIso());

    return { challengeId: id };
  });

  app.get('/api/challenges', { preHandler: [requireAuth] }, async (req) => {
    const user = currentUser(req);
    const rows = getDb()
      .prepare(
        `SELECT id, from_id, to_id, time_control, status, created_at
         FROM friends_challenges
         WHERE from_id = ? OR to_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
      )
      .all(user.id, user.id) as Array<{
      id: string;
      from_id: string;
      to_id: string;
      time_control: string;
      status: string;
      created_at: string;
    }>;

    return {
      challenges: rows.map((row) => ({
        id: row.id,
        fromId: row.from_id,
        toId: row.to_id,
        timeControl: row.time_control,
        status: row.status,
        createdAt: row.created_at,
      })),
    };
  });
}

export default registerSocialRoutes;
