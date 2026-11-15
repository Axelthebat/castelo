import type { GamePlayer, GameMove, ServerMessage } from '@castelo/shared';
import { Position, type Color, type MoveInfo, type PieceType } from '@castelo/engine';

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

export interface LiveGameConfig {
  id: string;
  mode: 'online' | 'bot';
  timeControl: string;
  baseMs: number;
  incrementMs: number;
  rated: boolean;
  white: GamePlayer;
  black: GamePlayer;
  botDifficulty?: 'beginner' | 'casual' | 'strong' | 'master';
  startFen?: string;
}

export interface ChatLine {
  from: string;
  text: string;
  at: number;
}

export interface PersistedMove {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  fen: string;
  ms: number;
}

/** Injetado pelo servidor — mantém o serviço de partida desacoplado do banco. */
export interface GamePersistence {
  saveMove(gameId: string, moves: PersistedMove[], snapshot: GameSnapshotRow): void;
  finish(
    gameId: string,
    result: string,
    termination: string,
    pgn: string,
    snapshot: GameSnapshotRow,
  ): void;
}

export interface GameSnapshotRow {
  fen: string;
  clockWhite: number;
  clockBlack: number;
  clockStartedAt: number | null;
}

export type GameListener = (message: ServerMessage) => void;

export class GameError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ *
 * Partida viva (autoritativa, em memória)
 * ------------------------------------------------------------------ */

export class LiveGame {
  readonly id: string;
  readonly mode: 'online' | 'bot';
  readonly timeControl: string;
  readonly rated: boolean;
  readonly white: GamePlayer;
  readonly black: GamePlayer;
  readonly botDifficulty?: 'beginner' | 'casual' | 'strong' | 'master';

  position: Position;
  moves: MoveInfo[] = [];
  chat: ChatLine[] = [];
  result: string | null = null;
  termination: string | null = null;
  lastMove: { from: string; to: string } | null = null;

  /** tempo restante em ms de cada lado */
  whiteMs: number;
  blackMs: number;
  /** lado em jogada */
  active: Color;
  /** instante (epoch ms) em que começou a contagem do turno atual */
  turnStartedAt: number;
  readonly incrementMs: number;

  private readonly listeners = new Set<GameListener>();
  private pendingDrawOffer: string | null = null;

  constructor(config: LiveGameConfig, now = Date.now()) {
    this.id = config.id;
    this.mode = config.mode;
    this.timeControl = config.timeControl;
    this.rated = config.rated;
    this.white = config.white;
    this.black = config.black;
    this.botDifficulty = config.botDifficulty;
    this.position = new Position(config.startFen);
    this.whiteMs = config.baseMs;
    this.blackMs = config.baseMs;
    this.active = this.position.turn();
    this.turnStartedAt = now;
    this.incrementMs = config.incrementMs;
  }

  /* -------------------------- assinatura -------------------------- */

  subscribe(listener: GameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: ServerMessage): void {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch {
        /* um assinante quebrado não pode derrubar a partida */
      }
    }
  }

  /* --------------------------- consulta --------------------------- */

  playerOf(userId: string): GamePlayer | null {
    if (this.white.id === userId) return this.white;
    if (this.black.id === userId) return this.black;
    return null;
  }

  colorOf(userId: string): Color | null {
    if (this.white.id === userId) return 'w';
    if (this.black.id === userId) return 'b';
    return null;
  }

  /** tempo restante considerando o turno em curso */
  remaining(color: Color, now = Date.now()): number {
    const base = color === 'w' ? this.whiteMs : this.blackMs;
    if (this.result !== null || color !== this.active) return base;
    return Math.max(0, base - (now - this.turnStartedAt));
  }

  snapshotRow(now = Date.now()): GameSnapshotRow {
    return {
      fen: this.position.fen(),
      clockWhite: this.remaining('w', now),
      clockBlack: this.remaining('b', now),
      clockStartedAt: this.turnStartedAt,
    };
  }

  isOver(): boolean {
    return this.result !== null;
  }

  /* ---------------------------- ações ----------------------------- */

  /** Debita o tempo do lado que estava na jogada e adiciona o incremento. */
  private debitClock(color: Color, now: number): number {
    const spent = Math.max(0, now - this.turnStartedAt);
    if (color === 'w') this.whiteMs = Math.max(0, this.whiteMs - spent);
    else this.blackMs = Math.max(0, this.blackMs - spent);
    this.turnStartedAt = now;
    if (color === 'w') this.whiteMs += this.incrementMs;
    else this.blackMs += this.incrementMs;
    return spent;
  }

  /**
   * Aplica um lance. Somente o lado em jogada pode mover.
   * Lança GameError em qualquer violação — o cliente nunca decide o resultado.
   */
  applyMove(
    userId: string,
    from: string,
    to: string,
    promotion?: string,
    now = Date.now(),
  ): GameMove {
    if (this.result !== null) {
      throw new GameError('game-over', 'A partida já terminou.', 409);
    }
    const color = this.colorOf(userId);
    if (!color) {
      throw new GameError('forbidden', 'Você não participa desta partida.', 403);
    }
    if (color !== this.active) {
      throw new GameError('not-your-turn', 'Não é a sua vez de jogar.', 409);
    }

    let move: MoveInfo;
    try {
      move = this.position.move(from, to, promotion);
    } catch (error) {
      throw new GameError('illegal-move', (error as Error).message, 422);
    }

    this.debitClock(color, now);
    this.moves.push(move);
    this.lastMove = { from: move.from, to: move.to };
    this.active = this.position.turn();

    const snapshot = this.snapshotRow(now);
    const payload: GameMove = {
      ply: this.moves.length,
      san: move.san,
      from: move.from,
      to: move.to,
      fen: move.fenAfter,
      clockWhite: snapshot.clockWhite,
      clockBlack: snapshot.clockBlack,
    };

    const end = this.position.gameEnd();
    if (end.over) {
      this.result = end.result;
      this.termination = end.reason;
      this.emit({ type: 'game:ended', result: end.result, reason: end.description });
    }

    return payload;
  }

  /** Marca o final por desistência, tempo, acordo de empate. */
  finish(result: string, reason: string, now = Date.now()): void {
    if (this.result !== null) return;
    this.debitClock(this.active, now);
    this.result = result;
    this.termination = reason;
    this.emit({ type: 'game:ended', result, reason });
  }

  resign(userId: string, now = Date.now()): void {
    const color = this.colorOf(userId);
    if (!color) throw new GameError('forbidden', 'Você não participa desta partida.', 403);
    this.finish(color === 'w' ? '0-1' : '1-0', 'Desistência', now);
  }

  offerDraw(userId: string): void {
    const color = this.colorOf(userId);
    if (!color) throw new GameError('forbidden', 'Você não participa desta partida.', 403);
    this.pendingDrawOffer = userId;
    const player = this.playerOf(userId);
    this.emit({ type: 'game:offer', by: player?.username ?? 'adversário' });
  }

  acceptDraw(userId: string, now = Date.now()): boolean {
    if (!this.pendingDrawOffer || this.pendingDrawOffer === userId) return false;
    this.pendingDrawOffer = null;
    this.finish('1/2-1/2', 'Empate por acordo', now);
    return true;
  }

  addChat(userId: string, text: string): ChatLine {
    const player = this.playerOf(userId);
    if (!player) throw new GameError('forbidden', 'Você não participa desta partida.', 403);
    const line: ChatLine = { from: player.username, text, at: Date.now() };
    this.chat.push(line);
    if (this.chat.length > 100) this.chat.shift();
    this.emit({ type: 'game:chat', from: line.from, text: line.text, at: line.at });
    return line;
  }

  toState(now = Date.now()) {
    const snapshot = this.snapshotRow(now);
    return {
      id: this.id,
      mode: this.mode,
      fen: this.position.fen(),
      turn: this.position.turn(),
      timeControl: this.timeControl,
      status: (this.result ? 'finished' : 'active') as 'active' | 'finished',
      result: this.result,
      termination: this.termination,
      white: this.white,
      black: this.black,
      clock: {
        white: snapshot.clockWhite,
        black: snapshot.clockBlack,
        activeColor: this.active,
        running: this.result === null,
        lastMoveAt: this.turnStartedAt,
      },
      moves: this.moves.map((m) => m.san),
      lastMove: this.lastMove,
    };
  }

  toPersistedMoves(): PersistedMove[] {
    return this.moves.map((m) => ({
      san: m.san,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      fen: m.fenAfter,
      ms: 0,
    }));
  }
}

/* ------------------------------------------------------------------ *
 * Registro de partidas ativas
 * ------------------------------------------------------------------ */

export class GameRegistry {
  private readonly games = new Map<string, LiveGame>();

  create(config: LiveGameConfig): LiveGame {
    const game = new LiveGame(config);
    this.games.set(game.id, game);
    return game;
  }

  get(id: string): LiveGame | undefined {
    return this.games.get(id);
  }

  require(id: string): LiveGame {
    const game = this.games.get(id);
    if (!game) throw new GameError('not-found', 'Partida não encontrada.', 404);
    return game;
  }

  remove(id: string): void {
    this.games.delete(id);
  }

  list(): LiveGame[] {
    return [...this.games.values()];
  }
}

export type { Color, MoveInfo, PieceType };
