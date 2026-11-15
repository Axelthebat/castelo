import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { loadEnv } from '../env.ts';
import { openDatabase } from './index.ts';
import { logger } from '../lib/logger.ts';
import { hashPassword } from '../lib/password.ts';
import { DAY_MS, nowIso } from '../lib/time.ts';
import { ensureSettings, findUserById, findUserByUsername } from '../repos/users.ts';
import { findFriendshipBetween } from '../repos/friends.ts';

/**
 * Seed de DESENVOLVIMENTO (idempotente):
 * - 3 usuários demo (senha `Castelo#2026!`);
 * - 6 partidas FINISHED com PGN reais e resultados variados;
 * - amizades/pedidos entre eles.
 * Executado por `npm run seed -w @castelo/server`.
 */

export const SEED_PASSWORD = 'Castelo#2026!';

interface SeedGameData {
  id: string;
  timeControl: string;
  result: string;
  termination: string;
  pgn: string;
  moves: Array<{ san: string; from: string; to: string; promotion?: string; fen: string; ms: number }>;
  finalFen: string;
}

export interface SeedSummary {
  users: number;
  games: number;
  friendships: number;
}

interface SeedUser {
  id: string;
  username: string;
  email: string;
  country: string;
  bio: string;
  location: string;
  favouritePiece: string;
  ratings: { bullet: number; blitz: number; rapid: number; classical: number };
  peak: number;
}

const SEED_USERS: SeedUser[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'demo',
    email: 'demo@castelo.dev',
    country: 'BR',
    bio: 'Conta de demonstração do Castelo.',
    location: 'São Paulo',
    favouritePiece: 'n',
    ratings: { bullet: 1180, blitz: 1450, rapid: 1520, classical: 1490 },
    peak: 1560,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'ana',
    email: 'ana@castelo.dev',
    country: 'PT',
    bio: 'Adoro sacrifícios e finais com dama.',
    location: 'Lisboa',
    favouritePiece: 'q',
    ratings: { bullet: 1500, blitz: 1620, rapid: 1580, classical: 1610 },
    peak: 1680,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'bruno',
    email: 'bruno@castelo.dev',
    country: 'BR',
    bio: 'Blitz e bullet, sempre.',
    location: 'Curitiba',
    favouritePiece: 'b',
    ratings: { bullet: 1700, blitz: 1380, rapid: 1300, classical: 1250 },
    peak: 1420,
  },
];

interface SeedGameAssignment {
  dataId: string;
  white: string;
  black: string | null;
  mode: 'online' | 'bot';
  rated: boolean;
  botDifficulty?: string;
}

const SEED_GAMES: SeedGameAssignment[] = [
  { dataId: 'seed-game-opera', white: 'demo', black: 'ana', mode: 'online', rated: true },
  { dataId: 'seed-game-immortal', white: 'ana', black: 'demo', mode: 'online', rated: true },
  { dataId: 'seed-game-scholar', white: 'demo', black: 'bruno', mode: 'online', rated: false },
  { dataId: 'seed-game-fools', white: 'bruno', black: 'ana', mode: 'online', rated: false },
  { dataId: 'seed-game-draw', white: 'ana', black: 'demo', mode: 'online', rated: true },
  { dataId: 'seed-game-berlin', white: 'demo', black: null, mode: 'bot', rated: false, botDifficulty: 'beginner' },
];

const SEED_FRIENDSHIPS = [
  { id: 'seed-friend-ana-bruno', requester: 'ana', addressee: 'bruno', status: 'friends' },
  { id: 'seed-friend-demo-ana', requester: 'demo', addressee: 'ana', status: 'pending' },
];

const SEED_BASE_DATE = Date.parse('2026-01-10T12:00:00.000Z');

function readSeedGames(): SeedGameData[] {
  const candidates = ['../../src/db/seed-games.json', './seed-games.json'] as const;
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(fileURLToPath(new URL(candidate, import.meta.url)), 'utf8')) as SeedGameData[];
    } catch {
      // tenta o próximo
    }
  }
  throw new Error('seed-games.json não encontrado');
}

function seedUser(db: DatabaseSync, seed: SeedUser) {
  const existing = findUserByUsername(db, seed.username);
  if (existing) return existing;

  const now = nowIso();
  db.prepare(
    `INSERT INTO users
       (id, username, email, password_hash, country, title, bio, location, favourite_piece,
        rating_bullet, rating_blitz, rating_rapid, rating_classical, peak_rating, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    seed.id,
    seed.username,
    seed.email,
    hashPassword(SEED_PASSWORD),
    seed.country,
    seed.bio,
    seed.location,
    seed.favouritePiece,
    seed.ratings.bullet,
    seed.ratings.blitz,
    seed.ratings.rapid,
    seed.ratings.classical,
    seed.peak,
    now,
    now,
  );
  ensureSettings(db, seed.id);
  return findUserById(db, seed.id)!;
}

function seedGame(db: DatabaseSync, data: SeedGameData, assignment: SeedGameAssignment, index: number, users: Map<string, string>) {
  const id = data.id;
  const existing = db.prepare('SELECT id FROM games WHERE id = ?').get(id);
  if (existing) return;

  const whiteId = users.get(assignment.white) ?? null;
  const blackId = assignment.black ? (users.get(assignment.black) ?? null) : null;
  const createdAt = new Date(SEED_BASE_DATE + index * DAY_MS).toISOString();
  const endedAt = new Date(Date.parse(createdAt) + (data.moves.length * 20 + 90) * 1000).toISOString();

  db.prepare(
    `INSERT INTO games
       (id, mode, status, time_control, rated, white_id, black_id, bot_difficulty, fen, pgn, result, termination,
        moves, clock_white, clock_black, clock_started_at, created_at, ended_at)
     VALUES (?, ?, 'finished', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    id,
    assignment.mode,
    data.timeControl,
    assignment.rated ? 1 : 0,
    whiteId,
    blackId,
    assignment.botDifficulty ?? null,
    data.finalFen,
    data.pgn,
    data.result,
    data.termination,
    JSON.stringify(data.moves),
    60000,
    60000,
    createdAt,
    endedAt,
  );
}

function seedFriendships(db: DatabaseSync, users: Map<string, string>) {
  let created = 0;
  for (const seed of SEED_FRIENDSHIPS) {
    const requesterId = users.get(seed.requester);
    const addresseeId = users.get(seed.addressee);
    if (!requesterId || !addresseeId) continue;
    const existing =
      findFriendshipBetween(db, requesterId, addresseeId) ?? findFriendshipBetween(db, addresseeId, requesterId);
    if (existing) continue;
    db.prepare(
      'INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(seed.id, requesterId, addresseeId, seed.status, nowIso());
    created += 1;
  }
  return created;
}

export function runSeed(db: DatabaseSync): SeedSummary {
  const users = new Map<string, string>();
  let userCount = 0;
  for (const seed of SEED_USERS) {
    const before = findUserByUsername(db, seed.username);
    const user = seedUser(db, seed);
    if (!before) userCount += 1;
    users.set(seed.username, user.id);
  }

  const games = readSeedGames();
  let gameCount = 0;
  for (let i = 0; i < games.length; i += 1) {
    const data = games[i];
    const assignment = SEED_GAMES.find((g) => g.dataId === data.id);
    if (!assignment) continue;
    const existing = db.prepare('SELECT id FROM games WHERE id = ?').get(data.id);
    seedGame(db, data, assignment, i, users);
    if (!existing) gameCount += 1;
  }

  const friendshipCount = seedFriendships(db, users);

  const summary = { users: userCount, games: gameCount, friendships: friendshipCount };
  logger.info('Seed concluído', summary);
  return summary;
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  const env = loadEnv();
  const db = openDatabase(env.DATABASE_PATH);
  try {
    runSeed(db);
  } finally {
    db.close();
  }
}
