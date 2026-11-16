import { z } from 'zod';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export const pieceSymbolSchema = z.enum([
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wP',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bP',
]);

export const colorSchema = z.enum(['w', 'b']);

export const squareSchema = z.string().regex(/^[a-h][1-8]$/, 'Casa inválida');

export const timeControlSchema = z.enum(['bullet', 'blitz', 'rapid', 'classical']);

export const timeControlOptions = {
  bullet: [
    { id: '1+0', label: '1 min', base: 60, increment: 0 },
    { id: '2+1', label: '2 min + 1s', base: 120, increment: 1 },
    { id: '3+0', label: '3 min', base: 180, increment: 0 },
    { id: '3+2', label: '3 min + 2s', base: 180, increment: 2 },
  ],
  blitz: [
    { id: '3+0', label: '3 min', base: 180, increment: 0 },
    { id: '3+2', label: '3 min + 2s', base: 180, increment: 2 },
    { id: '5+0', label: '5 min', base: 300, increment: 0 },
    { id: '5+3', label: '5 min + 3s', base: 300, increment: 3 },
  ],
  rapid: [
    { id: '10+0', label: '10 min', base: 600, increment: 0 },
    { id: '10+5', label: '10 min + 5s', base: 600, increment: 5 },
    { id: '15+10', label: '15 min + 10s', base: 900, increment: 10 },
    { id: '30+0', label: '30 min', base: 1800, increment: 0 },
  ],
  classical: [
    { id: '30+0', label: '30 min', base: 1800, increment: 0 },
    { id: '60+0', label: '60 min', base: 3600, increment: 0 },
    { id: '90+30', label: '90 min + 30s', base: 5400, increment: 30 },
    { id: '120+0', label: '120 min', base: 7200, increment: 0 },
  ],
} as const;

export type TimeControlCategory = keyof typeof timeControlOptions;

export const timeControlIdSchema = z.string().regex(/^\d+\+\d+$/, 'Controle de tempo inválido');

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .toLowerCase()
  .email('Informe um e-mail válido');

export const passwordSchema = z
  .string()
  .min(10, 'A senha precisa ter ao menos 10 caracteres')
  .max(200, 'Senha longa demais')
  .refine((v) => /[a-z]/.test(v), 'Inclua ao menos uma letra minúscula')
  .refine((v) => /[A-Z]/.test(v), 'Inclua ao menos uma letra maiúscula')
  .refine((v) => /\d/.test(v), 'Inclua ao menos um número');

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres')
  .max(20, 'Máximo de 20 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'Use apenas letras, números e _');

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Informe o usuário ou e-mail').max(254),
  password: z.string().min(1, 'Informe a senha').max(200),
  remember: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

export type RatingCategory = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface RatingSet {
  bullet: number;
  blitz: number;
  rapid: number;
  classical: number;
}

export interface PublicUser {
  id: string;
  username: string;
  country: string | null;
  title: string | null;
  createdAt: string;
  ratings: RatingSet;
  stats: Record<RatingCategory, GameStats>;
}

export interface GameStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface UserProfile extends PublicUser {
  bio: string | null;
  location: string | null;
  favouritePiece: string | null;
  totalGames: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  peakRating: number;
}

/** O próprio usuário — inclui o e-mail, que nunca é exposto publicamente. */
export interface CurrentUser extends PublicUser {
  email: string;
}

export const updateProfileSchema = z.object({
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).optional(),
});

export const updateSettingsSchema = z.object({
  boardTheme: z.enum(['walnut', 'emerald', 'slate', 'ice']).optional(),
  pieceTheme: z.enum(['castelo', 'classic']).optional(),
  showCoordinates: z.boolean().optional(),
  showLegalMoves: z.boolean().optional(),
  animateMoves: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(100).optional(),
  defaultTimeControl: timeControlIdSchema.optional(),
  boardOrientation: z.enum(['white', 'black', 'auto']).optional(),
});

export interface UserSettings {
  boardTheme: 'walnut' | 'emerald' | 'slate' | 'ice';
  pieceTheme: 'castelo' | 'classic';
  showCoordinates: boolean;
  showLegalMoves: boolean;
  animateMoves: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  defaultTimeControl: string;
  boardOrientation: 'white' | 'black' | 'auto';
}

/* ------------------------------------------------------------------ *
 * Games
 * ------------------------------------------------------------------ */

export const gameModeSchema = z.enum(['online', 'bot', 'puzzle']);
export const gameResultSchema = z.enum(['1-0', '0-1', '1/2-1/2', '*']);

export const createGameSchema = z.object({
  mode: gameModeSchema,
  timeControl: timeControlIdSchema,
  opponentId: z.string().optional(),
  botDifficulty: z.enum(['beginner', 'casual', 'strong', 'master']).optional(),
});

export interface GamePlayer {
  id: string;
  username: string;
  rating: number;
  isBot: boolean;
  avatarSeed: string;
}

export interface ClockState {
  white: number;
  black: number;
  activeColor: 'w' | 'b';
  running: boolean;
  lastMoveAt: number | null;
}

export interface GameState {
  id: string;
  mode: 'online' | 'bot' | 'puzzle';
  fen: string;
  turn: 'w' | 'b';
  timeControl: string;
  status: 'waiting' | 'active' | 'finished';
  result: string | null;
  termination: string | null;
  white: GamePlayer;
  black: GamePlayer;
  clock: ClockState;
  moves: string[];
  lastMove: { from: string; to: string } | null;
  ratingDelta?: { white: number; black: number };
}

export interface GameSummary {
  id: string;
  opponent: GamePlayer;
  color: 'w' | 'b';
  result: string;
  timeControl: string;
  endedAt: string;
  moves: number;
  accuracy?: number | null;
  rated: boolean;
}

export interface GameMove {
  ply: number;
  san: string;
  from: string;
  to: string;
  fen: string;
  clockWhite: number;
  clockBlack: number;
  eval?: number | null;
}

/* ------------------------------------------------------------------ *
 * Matchmaking
 * ------------------------------------------------------------------ */

export const joinQueueSchema = z.object({
  timeControl: timeControlIdSchema,
});

export interface QueueEntry {
  id: string;
  userId: string;
  username: string;
  rating: number;
  timeControl: string;
  joinedAt: number;
}

/* ------------------------------------------------------------------ *
 * Puzzles
 * ------------------------------------------------------------------ */

export interface PuzzleSolution {
  san: string;
  from: string;
  to: string;
  promotion?: string;
}

export interface Puzzle {
  id: string;
  fen: string;
  /** Solution in SAN. */
  moves: string[];
  /** Solution with origin and destination, for the board interaction. */
  solution: PuzzleSolution[];
  rating: number;
  themes: string[];
  ratingDeviation: number;
  popularity: number;
  title: string;
}

export interface PuzzleAttempt {
  puzzleId: string;
  solved: boolean;
  moves: string[];
  ratingBefore: number;
  ratingAfter: number;
}

/* ------------------------------------------------------------------ *
 * Leaderboard / friends
 * ------------------------------------------------------------------ */

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  country: string | null;
  avatarSeed: string;
}

export const friendRequestSchema = z.object({
  username: usernameSchema,
});

export interface Friend {
  id: string;
  username: string;
  rating: number;
  status: 'friends' | 'pending_out' | 'pending_in';
  avatarSeed: string;
  lastSeenAt: string | null;
}

/* ------------------------------------------------------------------ *
 * Realtime protocol (WebSocket)
 * ------------------------------------------------------------------ */

export type ClientMessage =
  | { type: 'game:subscribe'; gameId: string }
  | { type: 'queue:join'; timeControl: string }
  | { type: 'queue:leave' }
  | { type: 'game:move'; gameId: string; from: string; to: string; promotion?: string }
  | { type: 'game:resign'; gameId: string }
  | { type: 'game:offer_draw'; gameId: string }
  | { type: 'game:accept_draw'; gameId: string }
  | { type: 'game:rematch'; gameId: string }
  | { type: 'game:chat'; gameId: string; text: string }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'queue:waiting'; position: number }
  | { type: 'queue:matched'; gameId: string }
  | { type: 'queue:left' }
  | { type: 'game:state'; state: GameState }
  | { type: 'game:move'; move: GameMove }
  | { type: 'game:chat'; from: string; text: string; at: number }
  | { type: 'game:ended'; result: string; reason: string; ratingDelta?: { white: number; black: number } }
  | { type: 'game:offer'; by: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

/* ------------------------------------------------------------------ *
 * API envelopes
 * ------------------------------------------------------------------ */

export interface ApiError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export const LIMIT = {
  username: 20,
  email: 254,
  password: 200,
  bio: 500,
  chat: 500,
  pageSize: 25,
} as const;
