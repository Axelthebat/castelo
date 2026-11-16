import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserProfile, UserSettings } from '@castelo/shared';
import { updateProfileSchema, updateSettingsSchema } from '@castelo/shared';
import { getDb } from '../db/index.ts';
import { HttpError } from '../errors.ts';
import { parseBody, parseQuery } from '../lib/validate.ts';
import {
  ensureSettings,
  findUserByUsername,
  toPublicUser,
  updateSettings,
  updateUserProfile,
} from '../repos/users.ts';
import type { UserRow, UserSettingsRow } from '../repos/users.ts';
import { getUserStats, listUserGames } from '../repos/games.ts';
import type { UserStats } from '../repos/games.ts';
import { requireAuth } from '../plugins/auth.ts';
import { RATE_LIMITS } from '../plugins/rate-limit.ts';

const gamesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  opponent: z.string().trim().min(3).max(20).optional(),
});

function toProfile(row: UserRow, stats: UserStats): UserProfile {
  const publicUser = toPublicUser(row, stats.perCategory);
  return {
    ...publicUser,
    bio: row.bio,
    location: row.location,
    favouritePiece: row.favourite_piece,
    totalGames: stats.totalGames,
    winRate: stats.winRate,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    peakRating: row.peak_rating,
  };
}

function toSettings(row: UserSettingsRow): UserSettings {
  return {
    boardTheme: row.board_theme as UserSettings['boardTheme'],
    pieceTheme: row.piece_theme as UserSettings['pieceTheme'],
    showCoordinates: row.show_coordinates === 1,
    showLegalMoves: row.show_legal_moves === 1,
    animateMoves: row.animate_moves === 1,
    soundEnabled: row.sound_enabled === 1,
    soundVolume: row.sound_volume,
    defaultTimeControl: row.default_time_control,
    boardOrientation: row.board_orientation as UserSettings['boardOrientation'],
  };
}

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const rl = { rateLimit: RATE_LIMITS.default };

  app.patch('/me', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const patch = parseBody(updateProfileSchema, req.body);
    const updated = updateUserProfile(db, req.currentUser!.id, {
      bio: patch.bio,
      location: patch.location,
      country: patch.country,
    });
    if (!updated) throw new HttpError(404, 'not_found', 'Usuário não encontrado');
    return toProfile(updated, getUserStats(db, updated.id));
  });

  app.get('/me/settings', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    return toSettings(ensureSettings(db, req.currentUser!.id));
  });

  app.patch('/me/settings', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const patch = parseBody(updateSettingsSchema, req.body);
    ensureSettings(db, req.currentUser!.id);
    const updated = updateSettings(db, req.currentUser!.id, {
      boardTheme: patch.boardTheme,
      pieceTheme: patch.pieceTheme,
      showCoordinates: patch.showCoordinates,
      showLegalMoves: patch.showLegalMoves,
      animateMoves: patch.animateMoves,
      soundEnabled: patch.soundEnabled,
      soundVolume: patch.soundVolume,
      defaultTimeControl: patch.defaultTimeControl,
      boardOrientation: patch.boardOrientation,
    });
    return toSettings(updated);
  });

  app.get('/me/stats', { preHandler: [requireAuth], config: rl }, async (req) => {
    const db = getDb();
    const user = req.currentUser!;
    return { ...getUserStats(db, user.id), peakRating: user.peak_rating };
  });

  app.get('/:username', { config: rl }, async (req) => {
    const db = getDb();
    const { username } = req.params as { username: string };
    const user = findUserByUsername(db, username);
    if (!user) throw new HttpError(404, 'not_found', 'Usuário não encontrado');
    return toProfile(user, getUserStats(db, user.id));
  });

  app.get('/:username/games', { config: rl }, async (req) => {
    const db = getDb();
    const { username } = req.params as { username: string };
    const query = parseQuery(gamesQuerySchema, req.query);

    const user = findUserByUsername(db, username);
    if (!user) throw new HttpError(404, 'not_found', 'Usuário não encontrado');

    let opponentId: string | undefined;
    if (query.opponent) {
      const opponent = findUserByUsername(db, query.opponent);
      if (!opponent) throw new HttpError(404, 'not_found', 'Oponente não encontrado');
      opponentId = opponent.id;
    }

    return listUserGames(db, user.id, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
      opponentId,
    });
  });
}
