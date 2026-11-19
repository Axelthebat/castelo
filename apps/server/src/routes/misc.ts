import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { timeControlSchema } from '@castelo/shared';
import { getDb } from '../db/index.ts';
import { parseBody, parseQuery } from '../lib/validate.ts';
import { requireAuth } from '../plugins/auth.ts';
import { RATE_LIMITS } from '../plugins/rate-limit.ts';
import { getLeaderboard } from '../repos/ratings.ts';
import {
  checkPuzzleSolution,
  computePuzzleRating,
  getNextPuzzle,
  getPuzzleRating,
  recordAttempt,
  toPublicPuzzle,
} from '../repos/puzzles.ts';
import type { DatabaseSync } from 'node:sqlite';

const leaderboardQuerySchema = z.object({
  category: timeControlSchema.default('blitz'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const puzzleAttemptSchema = z.object({
  /** Jogadas em UCI: "e2e4", "e7e8q". */
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(20),
});

function findPuzzle(db: DatabaseSync, id: string) {
  const row = db.prepare('SELECT * FROM puzzles WHERE id = ?').get(id) as
    | import('../repos/puzzles.ts').PuzzleRow
    | undefined;
  return row ? toPublicPuzzle(row) : null;
}

/**
 * Leaderboard (público) e rating de quebra-cabeças (autenticado).
 * `GET /api/puzzles/next` fica para quando existir uma tabela de puzzles.
 */
export async function registerMiscRoutes(app: FastifyInstance): Promise<void> {
  const rl = { rateLimit: RATE_LIMITS.default };

  app.get('/leaderboard', { config: rl }, async (req) => {
    const db = getDb();
    const query = parseQuery(leaderboardQuerySchema, req.query);
    return getLeaderboard(db, query.category ?? 'blitz', {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  });

  app.get('/puzzles/rating', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    return {
      rating: getPuzzleRating(db, req.currentUser!.id),
      deviation: 120,
    };
  });

  app.get('/puzzles/next', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const query = z
      .object({ rating: z.coerce.number().int().min(100).max(4000).optional() })
      .parse(req.query);
    const user = req.currentUser!;
    const rating = query.rating ?? getPuzzleRating(db, user.id);
    const puzzle = getNextPuzzle(db, rating, user.id);
    if (!puzzle) {
      throw new (await import('../errors.ts')).HttpError(
        404,
        'not-found',
        'Não há problemas disponíveis para este nível.',
      );
    }
    return { puzzle };
  });

  app.post('/puzzles/:id/attempt', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const { id } = req.params as { id: string };
    const body = parseBody(puzzleAttemptSchema, req.body);
    const user = req.currentUser!;

    const puzzle = findPuzzle(db, id);
    if (!puzzle) {
      throw new (await import('../errors.ts')).HttpError(404, 'not-found', 'Problema não encontrado.');
    }

    // O servidor decide se acertou: o cliente nunca informa `solved`.
    const solved = checkPuzzleSolution(puzzle, body.moves);
    const update = computePuzzleRating(db, user.id, puzzle.rating, solved);
    recordAttempt(db, {
      userId: user.id,
      puzzleId: id,
      solved,
      moves: body.moves,
      ratingBefore: update.before,
      ratingAfter: update.after,
    });

    return {
      solved,
      ratingBefore: update.before,
      ratingAfter: update.after,
      solution: solved ? undefined : puzzle.moves,
    };
  });
}
