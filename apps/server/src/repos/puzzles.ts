import type { DatabaseSync } from 'node:sqlite';
import { eloUpdate } from '../lib/elo.ts';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';

/** Tentativas de quebra-cabeças e rating de problemas. */

export const DEFAULT_PUZZLE_RATING = 1200;

export interface PuzzleAttemptRow {
  id: string;
  user_id: string;
  puzzle_id: string;
  solved: number;
  moves: string;
  rating_before: number | null;
  rating_after: number | null;
  created_at: string;
}

export interface RecordAttemptInput {
  userId: string;
  puzzleId: string;
  solved: boolean;
  moves: string[];
  ratingBefore: number;
  ratingAfter: number;
}

export function recordAttempt(db: DatabaseSync, input: RecordAttemptInput): PuzzleAttemptRow {
  const id = newId();
  db.prepare(
    `INSERT INTO puzzle_attempts (id, user_id, puzzle_id, solved, moves, rating_before, rating_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.userId,
    input.puzzleId,
    input.solved ? 1 : 0,
    JSON.stringify(input.moves),
    input.ratingBefore,
    input.ratingAfter,
    nowIso(),
  );
  return {
    id,
    user_id: input.userId,
    puzzle_id: input.puzzleId,
    solved: input.solved ? 1 : 0,
    moves: JSON.stringify(input.moves),
    rating_before: input.ratingBefore,
    rating_after: input.ratingAfter,
    created_at: nowIso(),
  };
}

/** Rating atual de problemas: último rating_after, ou o default. */
export function getPuzzleRating(db: DatabaseSync, userId: string): number {
  const row = db
    .prepare('SELECT rating_after FROM puzzle_attempts WHERE user_id = ? AND rating_after IS NOT NULL ORDER BY created_at DESC LIMIT 1')
    .get(userId) as { rating_after: number } | undefined;
  return row?.rating_after ?? DEFAULT_PUZZLE_RATING;
}

export interface PuzzleRatingUpdate {
  before: number;
  after: number;
  delta: number;
}

export function computePuzzleRating(
  db: DatabaseSync,
  userId: string,
  puzzleRating: number,
  solved: boolean,
): PuzzleRatingUpdate {
  const before = getPuzzleRating(db, userId);
  const after = eloUpdate(before, puzzleRating, solved ? 1 : 0, 32);
  return { before, after, delta: after - before };
}
