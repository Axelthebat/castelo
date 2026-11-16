import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { GameStats, PublicUser, RatingCategory, RatingSet } from '@castelo/shared';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';

/** Acesso a usuários, settings e password resets. Consultas parameterizadas. */

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  country: string | null;
  title: string | null;
  bio: string | null;
  location: string | null;
  favourite_piece: string | null;
  rating_bullet: number;
  rating_blitz: number;
  rating_rapid: number;
  rating_classical: number;
  peak_rating: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  country?: string | null;
  title?: string | null;
  bio?: string | null;
  location?: string | null;
  favouritePiece?: string | null;
  ratings?: Partial<RatingSet>;
}

export interface UserSettingsRow {
  user_id: string;
  board_theme: string;
  piece_theme: string;
  show_coordinates: number;
  show_legal_moves: number;
  animate_moves: number;
  sound_enabled: number;
  sound_volume: number;
  default_time_control: string;
  board_orientation: string;
}

export interface PasswordResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
}

const USER_COLUMNS =
  'id, username, email, password_hash, country, title, bio, location, favourite_piece, ' +
  'rating_bullet, rating_blitz, rating_rapid, rating_classical, peak_rating, created_at, updated_at';

export function createUser(db: DatabaseSync, input: CreateUserInput): UserRow {
  const id = newId();
  const now = nowIso();
  const ratings = input.ratings ?? {};
  db.prepare(
    `INSERT INTO users
       (id, username, email, password_hash, country, title, bio, location, favourite_piece,
        rating_bullet, rating_blitz, rating_rapid, rating_classical, peak_rating, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.username,
    input.email,
    input.passwordHash,
    input.country ?? null,
    input.title ?? null,
    input.bio ?? null,
    input.location ?? null,
    input.favouritePiece ?? null,
    ratings.bullet ?? 1200,
    ratings.blitz ?? 1200,
    ratings.rapid ?? 1200,
    ratings.classical ?? 1200,
    ratings.rapid ?? 1200,
    now,
    now,
  );
  const user = findUserById(db, id);
  if (!user) throw new Error('Falha ao criar usuário');
  return user;
}

export function findUserById(db: DatabaseSync, id: string): UserRow | null {
  return (db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as UserRow | undefined) ?? null;
}

export function findUserByUsername(db: DatabaseSync, username: string): UserRow | null {
  return (
    (db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ?`).get(username) as UserRow | undefined) ?? null
  );
}

export function findUserByEmail(db: DatabaseSync, email: string): UserRow | null {
  return (db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(email) as UserRow | undefined) ?? null;
}

/** Login por username ou e-mail (ambos NOCASE). */
export function findUserByIdentifier(db: DatabaseSync, identifier: string): UserRow | null {
  return (
    (db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username = ? OR email = ?`).get(
      identifier,
      identifier,
    ) as UserRow | undefined) ?? null
  );
}

export interface ProfilePatch {
  bio?: string | null;
  location?: string | null;
  country?: string | null;
  favouritePiece?: string | null;
  title?: string | null;
}

const PROFILE_COLUMN_MAP: Record<keyof ProfilePatch, string> = {
  bio: 'bio',
  location: 'location',
  country: 'country',
  favouritePiece: 'favourite_piece',
  title: 'title',
};

export function updateUserProfile(db: DatabaseSync, id: string, patch: ProfilePatch): UserRow | null {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return findUserById(db, id);

  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  for (const [key, value] of entries) {
    clauses.push(`${PROFILE_COLUMN_MAP[key as keyof ProfilePatch]} = ?`);
    params.push(value);
  }
  clauses.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.prepare(`UPDATE users SET ${clauses.join(', ')} WHERE id = ?`).run(...params);
  return findUserById(db, id);
}

export function updateUserPassword(db: DatabaseSync, id: string, passwordHash: string): UserRow | null {
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, nowIso(), id);
  return findUserById(db, id);
}

export interface RatingsPatch {
  ratingBullet?: number;
  ratingBlitz?: number;
  ratingRapid?: number;
  ratingClassical?: number;
  peakRating?: number;
}

const RATING_COLUMN_MAP: Record<keyof RatingsPatch, string> = {
  ratingBullet: 'rating_bullet',
  ratingBlitz: 'rating_blitz',
  ratingRapid: 'rating_rapid',
  ratingClassical: 'rating_classical',
  peakRating: 'peak_rating',
};

export function updateUserRatings(db: DatabaseSync, id: string, patch: RatingsPatch): UserRow | null {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return findUserById(db, id);
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  for (const [key, value] of entries) {
    clauses.push(`${RATING_COLUMN_MAP[key as keyof RatingsPatch]} = ?`);
    params.push(value);
  }
  clauses.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);
  db.prepare(`UPDATE users SET ${clauses.join(', ')} WHERE id = ?`).run(...params);
  return findUserById(db, id);
}

/* ---------------- Settings ---------------- */

export function getSettings(db: DatabaseSync, userId: string): UserSettingsRow | null {
  return (db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as UserSettingsRow | undefined) ?? null;
}

export function ensureSettings(db: DatabaseSync, userId: string): UserSettingsRow {
  const existing = getSettings(db, userId);
  if (existing) return existing;
  db.prepare(
    `INSERT INTO user_settings
       (user_id, board_theme, piece_theme, show_coordinates, show_legal_moves, animate_moves,
        sound_enabled, sound_volume, default_time_control, board_orientation)
     VALUES (?, 'walnut', 'castelo', 1, 1, 1, 1, 60, '10+5', 'auto')`,
  ).run(userId);
  const created = getSettings(db, userId);
  if (!created) throw new Error('Falha ao criar settings');
  return created;
}

const SETTINGS_COLUMN_MAP: Record<string, string> = {
  boardTheme: 'board_theme',
  pieceTheme: 'piece_theme',
  showCoordinates: 'show_coordinates',
  showLegalMoves: 'show_legal_moves',
  animateMoves: 'animate_moves',
  soundEnabled: 'sound_enabled',
  soundVolume: 'sound_volume',
  defaultTimeControl: 'default_time_control',
  boardOrientation: 'board_orientation',
};

export type SettingsPatch = Partial<Record<keyof typeof SETTINGS_COLUMN_MAP, string | number | boolean>>;

export function updateSettings(db: DatabaseSync, userId: string, patch: SettingsPatch): UserSettingsRow {
  ensureSettings(db, userId);
  const entries = Object.entries(patch).filter(
    ([key, value]) => key in SETTINGS_COLUMN_MAP && value !== undefined,
  );
  if (entries.length > 0) {
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      clauses.push(`${SETTINGS_COLUMN_MAP[key]} = ?`);
      params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    params.push(userId);
    db.prepare(`UPDATE user_settings SET ${clauses.join(', ')} WHERE user_id = ?`).run(...params);
  }
  const updated = getSettings(db, userId);
  if (!updated) throw new Error('Falha ao atualizar settings');
  return updated;
}

/* ---------------- Password resets ---------------- */

export function createPasswordReset(
  db: DatabaseSync,
  input: { userId: string; tokenHash: string; expiresAt: string },
): PasswordResetRow {
  const id = newId();
  db.prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)').run(
    id,
    input.userId,
    input.tokenHash,
    input.expiresAt,
  );
  return {
    id,
    user_id: input.userId,
    token_hash: input.tokenHash,
    expires_at: input.expiresAt,
    used_at: null,
  };
}

export function findPasswordReset(db: DatabaseSync, tokenHash: string): PasswordResetRow | null {
  return (
    (db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').get(tokenHash) as
      | PasswordResetRow
      | undefined) ?? null
  );
}

export function consumePasswordReset(db: DatabaseSync, id: string, usedAt: string): void {
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(usedAt, id);
}

/* ---------------- Mapeamento ---------------- */

export function toRatings(row: UserRow): RatingSet {
  return {
    bullet: row.rating_bullet,
    blitz: row.rating_blitz,
    rapid: row.rating_rapid,
    classical: row.rating_classical,
  };
}

export const RATING_CATEGORIES: RatingCategory[] = ['bullet', 'blitz', 'rapid', 'classical'];

export function emptyStats(): Record<RatingCategory, GameStats> {
  return {
    bullet: { wins: 0, losses: 0, draws: 0 },
    blitz: { wins: 0, losses: 0, draws: 0 },
    rapid: { wins: 0, losses: 0, draws: 0 },
    classical: { wins: 0, losses: 0, draws: 0 },
  };
}

export function toPublicUser(row: UserRow, stats: Record<RatingCategory, GameStats>): PublicUser {
  return {
    id: row.id,
    username: row.username,
    country: row.country,
    title: row.title,
    createdAt: row.created_at,
    ratings: toRatings(row),
    stats,
  };
}
