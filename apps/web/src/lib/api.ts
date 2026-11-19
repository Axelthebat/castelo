import type {
  ApiError as ApiErrorShape,
  CurrentUser,
  Friend,
  GameMove,
  GameSummary,
  LeaderboardEntry,
  Puzzle,
  UserProfile,
  UserSettings,
} from '@castelo/shared';

/* ------------------------------------------------------------------ *
 * Cliente HTTP
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** headers extras */
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (MUTATING.has(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as ApiErrorShape | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'unknown',
      error?.message ?? 'Não foi possível concluir a operação.',
      error?.fields,
    );
  }

  return payload as T;
}

/* ------------------------------------------------------------------ *
 * Tipos de resposta
 * ------------------------------------------------------------------ */

export interface AuthResponse {
  user: CurrentUser;
  csrfToken: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------ */

export const api = {
  register: (payload: { username: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: { identifier: string; password: string; remember?: boolean }) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: payload }),

  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),

  me: (signal?: AbortSignal) => apiFetch<AuthResponse>('/auth/me', { signal }),

  forgot: (email: string) =>
    apiFetch<{ ok: true }>('/auth/forgot', { method: 'POST', body: { email } }),

  reset: (token: string, password: string) =>
    apiFetch<{ ok: true }>('/auth/reset', { method: 'POST', body: { token, password } }),

  profile: (username: string, signal?: AbortSignal) =>
    apiFetch<UserProfile>(`/users/${encodeURIComponent(username)}`, { signal }),

  updateProfile: (payload: { bio?: string; location?: string; country?: string }) =>
    apiFetch<UserProfile>('/users/me', { method: 'PATCH', body: payload }),

  settings: (signal?: AbortSignal) =>
    apiFetch<UserSettings>('/users/me/settings', { signal }),

  updateSettings: (payload: Partial<UserSettings>) =>
    apiFetch<UserSettings>('/users/me/settings', { method: 'PATCH', body: payload }),

  userGames: (username: string, page = 1, signal?: AbortSignal) =>
    apiFetch<Paginated<GameSummary>>(
      `/users/${encodeURIComponent(username)}/games?page=${page}`,
      { signal },
    ),

  stats: (signal?: AbortSignal) =>
    apiFetch<Record<string, unknown>>('/users/me/stats', { signal }),

  leaderboard: (category = 'blitz', page = 1, signal?: AbortSignal) =>
    apiFetch<Paginated<LeaderboardEntry>>(
      `/leaderboard?category=${category}&page=${page}`,
      { signal },
    ),

  nextPuzzle: (rating?: number, signal?: AbortSignal) =>
    apiFetch<{ puzzle: Puzzle }>(
      `/puzzles/next${rating ? `?rating=${rating}` : ''}`,
      { signal },
    ),

  attemptPuzzle: (id: string, moves: string[]) =>
    apiFetch<{ solved: boolean; ratingBefore: number; ratingAfter: number }>(
      `/puzzles/${encodeURIComponent(id)}/attempt`,
      { method: 'POST', body: { moves } },
    ),

  puzzleRating: (signal?: AbortSignal) =>
    apiFetch<{ rating: number; deviation: number }>('/puzzles/rating', { signal }),

  friends: (signal?: AbortSignal) => apiFetch<{ friends: Friend[] }>('/friends', { signal }),

  requestFriend: (username: string) =>
    apiFetch<{ ok: true }>('/friends/request', { method: 'POST', body: { username } }),

  acceptFriend: (id: string) =>
    apiFetch<{ ok: true }>(`/friends/${encodeURIComponent(id)}/accept`, { method: 'POST' }),

  removeFriend: (id: string) =>
    apiFetch<{ ok: true }>(`/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  challenge: (username: string, timeControl: string) =>
    apiFetch<{ challengeId: string }>('/challenges', {
      method: 'POST',
      body: { username, timeControl },
    }),

  challenges: (signal?: AbortSignal) =>
    apiFetch<{
      challenges: Array<{
        id: string;
        fromId: string;
        toId: string;
        timeControl: string;
        status: string;
        createdAt: string;
      }>;
    }>('/challenges', { signal }),

  acceptChallenge: (id: string) =>
    apiFetch<{ gameId: string }>(`/challenges/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
    }),

  declineChallenge: (id: string) =>
    apiFetch<{ ok: true }>(`/challenges/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createBotGame: (timeControl: string, difficulty: string) =>
    apiFetch<{ gameId: string }>('/games/bot', {
      method: 'POST',
      body: { timeControl, difficulty },
    }),

  game: (id: string, signal?: AbortSignal) =>
    apiFetch<import('@castelo/shared').GameState>(`/games/${encodeURIComponent(id)}`, { signal }),

  gamePgn: (id: string, signal?: AbortSignal) =>
    apiFetch<{ pgn: string }>(`/games/${encodeURIComponent(id)}/pgn`, { signal }),

  gameMoves: (id: string, signal?: AbortSignal) =>
    apiFetch<{ moves: GameMove[] }>(`/games/${encodeURIComponent(id)}/moves`, { signal }),

  move: (id: string, from: string, to: string, promotion?: string) =>
    apiFetch<import('@castelo/shared').GameMove>(
      `/games/${encodeURIComponent(id)}/move`,
      { method: 'POST', body: { from, to, promotion } },
    ),

  resign: (id: string) =>
    apiFetch<{ result: string }>(`/games/${encodeURIComponent(id)}/resign`, { method: 'POST' }),
};
