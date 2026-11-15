import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { timeControlSchema } from '@castelo/shared';
import { getDb } from '../db/index.ts';
import { parseBody, parseQuery } from '../lib/validate.ts';
import { requireAuth } from '../plugins/auth.ts';
import { RATE_LIMITS } from '../plugins/rate-limit.ts';
import { getLeaderboard } from '../repos/ratings.ts';
import { computePuzzleRating, getPuzzleRating, recordAttempt } from '../repos/puzzles.ts';

const leaderboardQuerySchema = z.object({
  category: timeControlSchema.default('blitz'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const puzzleAttemptSchema = z.object({
  solved: z.boolean(),
  moves: z.array(z.string().min(1).max(20)).max(100),
  puzzleRating: z.number().int().min(100).max(4000).default(1200),
});

/**
 * Leaderboard (público) e rating de quebra-cabeças (autenticado).
 * `GET /api/puzzles/next` fica para quando existir uma tabela de puzzles.
 */
export async function registerMiscRoutes(app: FastifyInstance): Promise<void> {
  const rl = { rateLimit: RATE_LIMITS.default };

  app.get('/leaderboard', { config: rl }, async (req) => {
    const db = getDb();
    const query = parseQuery(leaderboardQuerySchema, req.query);
    return getLeaderboard(db, query.category, { page: query.page, pageSize: query.pageSize });
  });

  app.get('/puzzles/rating', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    return { rating: getPuzzleRating(db, req.currentUser!.id) };
  });

  app.post('/puzzles/:id/attempt', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const body = parseBody(puzzleAttemptSchema, req.body);
    const user = req.currentUser!;

    const update = computePuzzleRating(db, user.id, body.puzzleRating, body.solved);
    recordAttempt(db, {
      userId: user.id,
      puzzleId: id,
      solved: body.solved,
      moves: body.moves,
      ratingBefore: update.before,
      ratingAfter: update.after,
    });

    return { rating: update.after, delta: update.delta, solved: body.solved };
  });
}
