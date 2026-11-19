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

/* ------------------------------------------------------------------ *
 * Catálogo de problemas
 * ------------------------------------------------------------------ */

export interface PuzzleRow {
  id: string;
  fen: string;
  moves: string;
  rating: number;
  rating_deviation: number;
  popularity: number;
  themes: string;
  title: string;
}

export interface PuzzleSolutionStep {
  san: string;
  from: string;
  to: string;
  promotion?: string;
}

export interface PublicPuzzle {
  id: string;
  fen: string;
  /** SAN, para exibição. */
  moves: string[];
  /** Jogadas com origem e destino, para o tabuleiro e para a validação. */
  solution: PuzzleSolutionStep[];
  rating: number;
  themes: string[];
  ratingDeviation: number;
  popularity: number;
  title: string;
}

export function toPublicPuzzle(row: PuzzleRow): PublicPuzzle {
  const solution = JSON.parse(row.moves) as PuzzleSolutionStep[];
  return {
    id: row.id,
    fen: row.fen,
    moves: solution.map((step) => step.san),
    solution,
    rating: row.rating,
    themes: JSON.parse(row.themes) as string[],
    ratingDeviation: row.rating_deviation,
    popularity: row.popularity,
    title: row.title,
  };
}

/**
 * Escolhe um problema com rating próximo do jogador, evitando os que ele
 * resolveu recentemente. Ordenação determinística por desvio de rating.
 */
export function getNextPuzzle(
  db: DatabaseSync,
  rating: number,
  userId?: string,
): PublicPuzzle | null {
  const rows = db
    .prepare(
      `SELECT p.* FROM puzzles p
       WHERE (? IS NULL OR p.id NOT IN (
         SELECT puzzle_id FROM puzzle_attempts
         WHERE user_id = ? AND created_at > ?
       ))
       ORDER BY ABS(p.rating - ?) ASC, p.popularity DESC
       LIMIT 1`,
    )
    .all(
      userId ?? null,
      userId ?? null,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      rating,
    ) as unknown as PuzzleRow[];

  const row = rows[0];
  return row ? toPublicPuzzle(row) : null;
}

/** Verifica se as jogadas do jogador seguem exatamente a solução gravada. */
export function checkPuzzleSolution(
  puzzle: PublicPuzzle,
  played: string[],
): boolean {
  if (played.length !== puzzle.solution.length) return false;
  return puzzle.solution.every((step, index) => {
    const uci = `${step.from}${step.to}${step.promotion ?? ''}`;
    return played[index] === uci;
  });
}
