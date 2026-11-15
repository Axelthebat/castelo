import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { LeaderboardEntry, RatingCategory } from '@castelo/shared';
import { timeControlOptions } from '@castelo/shared';

/** Leaderboard por categoria de rating (página 25 por padrão). */

const CATEGORY_COLUMN: Record<RatingCategory, string> = {
  bullet: 'rating_bullet',
  blitz: 'rating_blitz',
  rapid: 'rating_rapid',
  classical: 'rating_classical',
};

const CATEGORY_TIME_CONTROLS: Record<RatingCategory, string[]> = (() => {
  const map: Record<RatingCategory, string[]> = { bullet: [], blitz: [], rapid: [], classical: [] };
  const seen = new Set<string>();
  for (const [category, options] of Object.entries(timeControlOptions)) {
    for (const option of options) {
      if (seen.has(option.id)) continue; // 3+0 e 3+2 pertencem ao bullet (primeira ocorrência)
      seen.add(option.id);
      map[category as RatingCategory].push(option.id);
    }
  }
  return map;
})();

export const RATING_CATEGORIES: RatingCategory[] = ['bullet', 'blitz', 'rapid', 'classical'];

export function avatarSeed(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 16);
}

export interface LeaderboardOptions {
  page: number;
  pageSize: number;
}

export function getLeaderboard(
  db: DatabaseSync,
  category: RatingCategory,
  options: LeaderboardOptions,
): { items: LeaderboardEntry[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, options.page);
  const pageSize = Math.max(1, options.pageSize);
  const offset = (page - 1) * pageSize;

  const column = CATEGORY_COLUMN[category];
  const timeControls = CATEGORY_TIME_CONTROLS[category];
  const placeholders = timeControls.map(() => '?').join(', ');
  const gameFilter = `g.status = 'finished' AND g.result IS NOT NULL AND g.time_control IN (${placeholders})`;

  const totalRow = db.prepare('SELECT COUNT(*) AS total FROM users').get() as { total: number };
  const total = totalRow.total;

  const statsSelect = `
    (SELECT COUNT(*) FROM games g WHERE ${gameFilter} AND ((g.white_id = u.id AND g.result = '1-0') OR (g.black_id = u.id AND g.result = '0-1'))) AS wins,
    (SELECT COUNT(*) FROM games g WHERE ${gameFilter} AND ((g.white_id = u.id AND g.result = '0-1') OR (g.black_id = u.id AND g.result = '1-0'))) AS losses,
    (SELECT COUNT(*) FROM games g WHERE ${gameFilter} AND g.result = '1/2-1/2' AND (g.white_id = u.id OR g.black_id = u.id)) AS draws`;

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.country, u.${column} AS rating, ${statsSelect}
       FROM users u
       ORDER BY u.${column} DESC, u.username ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...timeControls, ...timeControls, ...timeControls, pageSize, offset) as Array<{
    id: string;
    username: string;
    country: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
  }>;

  const items: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: offset + index + 1,
    userId: row.id,
    username: row.username,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    country: row.country,
    avatarSeed: avatarSeed(row.id),
  }));

  return { items, total, page, pageSize };
}
