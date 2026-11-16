import { botMove, BOT_PROFILES, type BotDifficulty } from '@castelo/engine';
import type { LiveGame } from './game-service.ts';

/**
 * O bot joga no mesmo objeto de partida do jogador humano: o servidor
 * aplica o lance com a mesma validação usada para o adversário humano.
 * A diferença é apenas de quem escolhe o lance.
 */
export class BotService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  private readonly options: {
    /** Atraso mínimo antes de o bot responder, para parecer humano. */
    minDelayMs?: number;
    /** Atraso máximo. */
    maxDelayMs?: number;
    /** Desliga o bot (útil em testes). */
    enabled?: boolean;
  };

  constructor(options: {
    minDelayMs?: number;
    maxDelayMs?: number;
    enabled?: boolean;
  } = {}) {
    this.options = options;
  }

  private difficultyOf(game: LiveGame): BotDifficulty {
    return (game.botDifficulty ?? 'casual') as BotDifficulty;
  }

  /** Agenda a jogada do bot para a posição atual da partida. */
  schedule(game: LiveGame): void {
    if (this.options.enabled === false) return;
    if (game.mode !== 'bot') return;
    if (game.isOver()) return;

    this.clear(game.id);

    const min = this.options.minDelayMs ?? 350;
    const max = this.options.maxDelayMs ?? 900;

    const timer = setTimeout(() => {
      this.timers.delete(game.id);
      void this.play(game);
    }, min + Math.random() * Math.max(0, max - min));

    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(game.id, timer);
  }

  /** Executa o lance do bot imediatamente. */
  async play(game: LiveGame): Promise<void> {
    if (game.isOver()) return;

    const difficulty = this.difficultyOf(game);
    const profile = BOT_PROFILES[difficulty];

    let chosen;
    try {
      chosen = botMove(game.position, { difficulty, timeBudgetMs: profile.timeBudgetMs });
    } catch {
      return;
    }

    if (!game.position.isLegal(chosen.from, chosen.to, chosen.promotion)) return;

    try {
      game.applyMove(game.black.id, chosen.from, chosen.to, chosen.promotion);
      game.emit({
        type: 'game:move',
        move: {
          ply: game.moves.length,
          san: chosen.san,
          from: chosen.from,
          to: chosen.to,
          fen: game.position.fen(),
          clockWhite: game.remaining('w'),
          clockBlack: game.remaining('b'),
        },
      });
    } catch {
      /* o lance do bot foi recusado — a partida continua */
    }
  }

  clear(gameId: string): void {
    const timer = this.timers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(gameId);
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
