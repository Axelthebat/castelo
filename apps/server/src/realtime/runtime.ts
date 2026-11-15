import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { GamePlayer, GameState } from '@castelo/shared';
import { eloUpdate, toPgn, BOT_PROFILES } from '@castelo/engine';
import { getDb } from '../db/index.ts';
import { saveGame, type GameRow } from '../repos/games.ts';
import { updateUserRatings } from '../repos/users.ts';
import { categoryForTimeControl } from '../repos/games.ts';
import { avatarSeed } from '../repos/ratings.ts';
import { GameRegistry, LiveGame } from './game-service.ts';
import { BotService } from './bot-service.ts';

/* ------------------------------------------------------------------ *
 * Tempo
 * ------------------------------------------------------------------ */

export interface TimeControl {
  baseMs: number;
  incrementMs: number;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical';
}

export function parseTimeControl(id: string): TimeControl | null {
  const match = /^(\d+)\+(\d+)$/.exec(id);
  if (!match) return null;
  const base = Number(match[1]);
  const increment = Number(match[2]);
  if (!Number.isFinite(base) || !Number.isFinite(increment)) return null;
  if (base < 1 || base > 180 || increment < 0 || increment > 60) return null;
  return {
    baseMs: base * 60_000,
    incrementMs: increment * 1_000,
    category: categoryForTimeControl(id),
  };
}

/* ------------------------------------------------------------------ *
 * Persistência
 * ------------------------------------------------------------------ */

function toGameRow(game: LiveGame): GameRow {
  const snapshot = game.snapshotRow();
  return {
    id: game.id,
    mode: game.mode,
    status: game.isOver() ? 'finished' : 'active',
    time_control: game.timeControl,
    rated: game.rated ? 1 : 0,
    white_id: game.white.id,
    black_id: game.black.id,
    bot_difficulty: game.botDifficulty ?? null,
    fen: game.position.fen(),
    pgn: null,
    result: game.result,
    termination: game.termination,
    moves: JSON.stringify(game.toPersistedMoves()),
    clock_white: snapshot.clockWhite,
    clock_black: snapshot.clockBlack,
    clock_started_at: snapshot.clockStartedAt,
    created_at: new Date().toISOString(),
    ended_at: game.isOver() ? new Date().toISOString() : null,
  };
}

/* ------------------------------------------------------------------ *
 * Runtime
 * ------------------------------------------------------------------ */

/**
 * Estado compartilhado do servidor: partidas vivas, bot e persistência.
 * As rotas REST e o hub WebSocket falam com este runtime.
 */
export class GameRuntime {
  readonly registry = new GameRegistry();
  readonly bot = new BotService();

  constructor(private db: DatabaseSync = getDb()) {}

  setDb(db: DatabaseSync): void {
    this.db = db;
  }

  /* --------------------------- criação --------------------------- */

  createOnlineGame(
    white: { id: string; username: string; rating: number },
    black: { id: string; username: string; rating: number },
    timeControl: TimeControl,
  ): LiveGame {
    const game = this.registry.create({
      id: randomUUID(),
      mode: 'online',
      timeControl: formatTimeControl(timeControl),
      baseMs: timeControl.baseMs,
      incrementMs: timeControl.incrementMs,
      rated: true,
      white: toPlayer(white, false),
      black: toPlayer(black, false),
    });
    this.persist(game);
    return game;
  }

  createBotGame(
    human: { id: string; username: string; rating: number },
    timeControl: TimeControl,
    difficulty: keyof typeof BOT_PROFILES,
  ): LiveGame {
    const game = this.registry.create({
      id: randomUUID(),
      mode: 'bot',
      timeControl: formatTimeControl(timeControl),
      baseMs: timeControl.baseMs,
      incrementMs: timeControl.incrementMs,
      rated: false,
      white: toPlayer(human, false),
      black: {
        id: `bot:${difficulty}`,
        username: BOT_PROFILES[difficulty]?.label ?? 'Bot',
        rating: 1200,
        isBot: true,
        avatarSeed: `bot-${difficulty}`,
      },
      botDifficulty: difficulty,
    });
    this.persist(game);
    return game;
  }

  /* --------------------------- persistência --------------------------- */

  persist(game: LiveGame): void {
    try {
      saveGame(this.db, toGameRow(game));
    } catch {
      /* a persistência não pode derrubar a partida */
    }
  }

  persistMove(game: LiveGame): void {
    this.persist(game);
  }

  /** Encerra a partida, grava o PGN e atualiza o rating dos jogadores humanos. */
  finish(game: LiveGame): { white: number; black: number } | undefined {
    if (!game.isOver()) return undefined;

    const headers = {
      Event: game.mode === 'bot' ? 'Castelo vs Bot' : 'Castelo',
      Site: 'Castelo',
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      Round: '-',
      White: game.white.username,
      Black: game.black.username,
      WhiteElo: game.white.rating,
      BlackElo: game.black.rating,
      Result: game.result ?? '*',
      TimeControl: game.timeControl,
      Termination: game.termination ?? 'unknown',
    };

    const row = toGameRow(game);
    row.pgn = toPgn(game.position, headers);
    row.status = 'finished';
    row.ended_at = new Date().toISOString();

    try {
      saveGame(this.db, row);
    } catch {
      /* ignora */
    }

    if (!game.rated || !game.result) return undefined;
    if (game.white.isBot || game.black.isBot) return undefined;

    const category = categoryForTimeControl(game.timeControl);
    const update = eloUpdate(
      game.white.rating,
      game.black.rating,
      game.result as '1-0' | '0-1' | '1/2-1/2',
    );

    const ratingKey = RATING_PATCH_KEY[category];

    try {
      updateUserRatings(this.db, game.white.id, { [ratingKey]: update.white });
      updateUserRatings(this.db, game.black.id, { [ratingKey]: update.black });
    } catch {
      /* ignora */
    }

    return { white: update.white - game.white.rating, black: update.black - game.black.rating };
  }
}

const RATING_PATCH_KEY = {
  bullet: 'ratingBullet',
  blitz: 'ratingBlitz',
  rapid: 'ratingRapid',
  classical: 'ratingClassical',
} as const;

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatTimeControl(timeControl: TimeControl): string {
  const base = Math.round(timeControl.baseMs / 60_000);
  const increment = Math.round(timeControl.incrementMs / 1_000);
  return `${base}+${increment}`;
}

function toPlayer(
  player: { id: string; username: string; rating: number },
  isBot: boolean,
): GamePlayer {
  return {
    id: player.id,
    username: player.username,
    rating: player.rating,
    isBot,
    avatarSeed: avatarSeed(player.id),
  };
}

export function toGameState(game: LiveGame): GameState {
  return game.toState();
}

let runtime: GameRuntime | null = null;

export function getRuntime(): GameRuntime {
  if (!runtime) runtime = new GameRuntime();
  return runtime;
}

export function setRuntime(instance: GameRuntime): void {
  runtime = instance;
}
