import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { GamePlayer, GameStats, GameSummary, RatingCategory } from '@castelo/shared';
import { timeControlOptions } from '@castelo/shared';
import { scoreForResult } from '../lib/elo.ts';
import { emptyStats } from './users.ts';

/** Partidas: persistência (moves em JSON), listagem e estatísticas. */

export interface GameMove {
  san: string;
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  fen: string;
  ms: number;
}

export interface GameRow {
  id: string;
  mode: 'online' | 'bot' | 'puzzle';
  status: 'waiting' | 'active' | 'finished';
  time_control: string;
  rated: number;
  white_id: string | null;
  black_id: string | null;
  bot_difficulty: string | null;
  fen: string;
  pgn: string | null;
  result: string | null;
  termination: string | null;
  moves: string;
  clock_white: number | null;
  clock_black: number | null;
  clock_started_at: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface UserStats {
  perCategory: Record<RatingCategory, GameStats>;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
}

const TIME_CONTROL_CATEGORY: Record<string, RatingCategory> = (() => {
  const map: Record<string, RatingCategory> = {};
  for (const [category, options] of Object.entries(timeControlOptions)) {
    for (const option of options) map[option.id] = category as RatingCategory;
  }
  return map;
})();

export function categoryForTimeControl(timeControl: string): RatingCategory {
  const exact = TIME_CONTROL_CATEGORY[timeControl];
  if (exact) return exact;
  const base = Number(timeControl.split('+')[0]);
  if (!Number.isFinite(base) || base <= 0) return 'blitz';
  if (base < 3) return 'bullet';
  if (base <= 5) return 'blitz';
  if (base <= 30) return 'rapid';
  return 'classical';
}

const GAME_COLUMNS =
  'id, mode, status, time_control, rated, white_id, black_id, bot_difficulty, fen, pgn, result, termination, ' +
  'moves, clock_white, clock_black, clock_started_at, created_at, ended_at';

export function parseMoves(raw: string): GameMove[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GameMove[]) : [];
  } catch {
    return [];
  }
}

export function saveGame(db: DatabaseSync, game: GameRow): void {
  db.prepare(
    `INSERT INTO games
       (id, mode, status, time_control, rated, white_id, black_id, bot_difficulty, fen, pgn, result, termination,
        moves, clock_white, clock_black, clock_started_at, created_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode, status = excluded.status, time_control = excluded.time_control,
       rated = excluded.rated, white_id = excluded.white_id, black_id = excluded.black_id,
       bot_difficulty = excluded.bot_difficulty, fen = excluded.fen, pgn = excluded.pgn,
       result = excluded.result, termination = excluded.termination, moves = excluded.moves,
       clock_white = excluded.clock_white, clock_black = excluded.clock_black,
       clock_started_at = excluded.clock_started_at, created_at = excluded.created_at,
       ended_at = excluded.ended_at`,
  ).run(
    game.id,
    game.mode,
    game.status,
    game.time_control,
    game.rated,
    game.white_id,
    game.black_id,
    game.bot_difficulty,
    game.fen,
    game.pgn,
    game.result,
    game.termination,
    game.moves,
    game.clock_white,
    game.clock_black,
    game.clock_started_at,
    game.created_at,
    game.ended_at,
  );
}

export function getGame(db: DatabaseSync, id: string): GameRow | null {
  return (db.prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE id = ?`).get(id) as GameRow | undefined) ?? null;
}

export function getGamePgn(db: DatabaseSync, id: string): string | null {
  const row = db.prepare('SELECT pgn FROM games WHERE id = ?').get(id) as { pgn: string | null } | undefined;
  return row?.pgn ?? null;
}

/* ---------------- Listagem ---------------- */

export interface ListUserGamesOptions {
  page: number;
  pageSize: number;
  opponentId?: string;
}

export interface GameListItem extends GameSummary {}

interface GameJoinRow extends GameRow {
  white_username: string | null;
  black_username: string | null;
  white_rating_bullet: number | null;
  black_rating_bullet: number | null;
  white_rating_blitz: number | null;
  black_rating_blitz: number | null;
  white_rating_rapid: number | null;
  black_rating_rapid: number | null;
  white_rating_classical: number | null;
  black_rating_classical: number | null;
}

function ratingFrom(row: GameJoinRow, side: 'w' | 'b', category: RatingCategory): number {
  const prefix = side === 'w' ? 'white' : 'black';
  const key = `${prefix}_rating_${category}` as keyof GameJoinRow;
  const value = row[key];
  return typeof value === 'number' ? value : 0;
}

function toPlayer(row: GameJoinRow, side: 'w' | 'b', category: RatingCategory): GamePlayer {
  const prefix = side === 'w' ? 'white' : 'black';
  const username = row[`${prefix}_username` as keyof GameJoinRow];
  const isBot = row.mode === 'bot' && !row[`${prefix}_id` as keyof GameJoinRow];
  if (isBot) {
    const difficulty = row.bot_difficulty ?? 'casual';
    return {
      id: `bot-${difficulty}`,
      username: `Bot ${difficulty}`,
      rating: 0,
      isBot: true,
      avatarSeed: `bot-${difficulty}`,
    };
  }
  return {
    id: String(row[`${prefix}_id` as keyof GameJoinRow] ?? ''),
    username: String(username ?? 'Desconhecido'),
    rating: ratingFrom(row, side, category),
    isBot: false,
    avatarSeed: String(row[`${prefix}_id` as keyof GameJoinRow] ?? username ?? ''),
  };
}

export function listUserGames(
  db: DatabaseSync,
  userId: string,
  options: ListUserGamesOptions,
): { items: GameListItem[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, options.page);
  const pageSize = Math.max(1, options.pageSize);
  const offset = (page - 1) * pageSize;

  const baseWhere = '(g.white_id = ? OR g.black_id = ?)';
  const opponentWhere = options.opponentId
    ? ` AND ((g.white_id = ? AND g.black_id = ?) OR (g.white_id = ? AND g.black_id = ?))`
    : '';
  const baseParams: SQLInputValue[] = [userId, userId];
  const opponentParams: SQLInputValue[] = options.opponentId
    ? [options.opponentId, userId, userId, options.opponentId]
    : [];

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM games g WHERE ${baseWhere}${opponentWhere}`)
    .get(...baseParams, ...opponentParams) as { total: number };
  const total = countRow.total;

  const rows = db
    .prepare(
      `SELECT g.*,
              uw.username AS white_username, ub.username AS black_username,
              uw.rating_bullet AS white_rating_bullet, ub.rating_bullet AS black_rating_bullet,
              uw.rating_blitz AS white_rating_blitz, ub.rating_blitz AS black_rating_blitz,
              uw.rating_rapid AS white_rating_rapid, ub.rating_rapid AS black_rating_rapid,
              uw.rating_classical AS white_rating_classical, ub.rating_classical AS black_rating_classical
       FROM games g
       LEFT JOIN users uw ON uw.id = g.white_id
       LEFT JOIN users ub ON ub.id = g.black_id
       WHERE ${baseWhere}${opponentWhere}
       ORDER BY COALESCE(g.ended_at, g.created_at) DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...baseParams, ...opponentParams, pageSize, offset) as unknown as GameJoinRow[];

  const items = rows.map((row) => {
    const category = categoryForTimeControl(row.time_control);
    const color: 'w' | 'b' = row.white_id === userId ? 'w' : 'b';
    const opponentColor: 'w' | 'b' = color === 'w' ? 'b' : 'w';
    return {
      id: row.id,
      opponent: toPlayer(row, opponentColor, category),
      color,
      result: row.result ?? '*',
      timeControl: row.time_control,
      endedAt: row.ended_at ?? row.created_at,
      moves: parseMoves(row.moves).length,
      accuracy: null,
      rated: row.rated === 1,
    };
  });

  return { items, total, page, pageSize };
}

/* ---------------- Estatísticas ---------------- */

export function getUserStats(db: DatabaseSync, userId: string): UserStats {
  const rows = db
    .prepare(
      `SELECT time_control, result, white_id, black_id, COALESCE(ended_at, created_at) AS ended_at
       FROM games
       WHERE (white_id = ? OR black_id = ?) AND status = 'finished' AND result IS NOT NULL
       ORDER BY ended_at ASC`,
    )
    .all(userId, userId) as Array<{
    time_control: string;
    result: string;
    white_id: string | null;
    black_id: string | null;
  }>;

  const perCategory = emptyStats();
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let streak = 0;
  let bestStreak = 0;

  for (const row of rows) {
    const category = categoryForTimeControl(row.time_control);
    const perspective: 'w' | 'b' = row.white_id === userId ? 'w' : 'b';
    const score = scoreForResult(row.result as '1-0' | '0-1' | '1/2-1/2', perspective);
    if (score === 1) {
      wins += 1;
      perCategory[category].wins += 1;
      streak = streak > 0 ? streak + 1 : 1;
      bestStreak = Math.max(bestStreak, streak);
    } else if (score === 0) {
      losses += 1;
      perCategory[category].losses += 1;
      streak = streak < 0 ? streak - 1 : -1;
    } else {
      draws += 1;
      perCategory[category].draws += 1;
      streak = 0;
    }
  }

  const totalGames = wins + losses + draws;
  const winRate = totalGames === 0 ? 0 : Math.round((wins / totalGames) * 1000) / 10;

  return {
    perCategory,
    totalGames,
    wins,
    losses,
    draws,
    winRate,
    currentStreak: streak,
    bestStreak,
  };
}
