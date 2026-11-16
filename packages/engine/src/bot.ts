import { Chess, type Move } from 'chess.js';
import type { Position } from './position.ts';
import type { PieceType } from './types.ts';

export type BotDifficulty = 'beginner' | 'casual' | 'strong' | 'master';

export interface BotOptions {
  difficulty: BotDifficulty;
  timeBudgetMs?: number;
  seed?: number;
}

export interface BotMoveResult {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  score: number;
}

export interface BotProfile {
  label: string;
  description: string;
  depth: number;
  timeBudgetMs: number;
  blunderRate: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  beginner: {
    label: 'Aprendiz',
    description: 'Erra bastante — ideal para começar',
    depth: 1,
    timeBudgetMs: 120,
    blunderRate: 0.55,
  },
  casual: {
    label: 'Casual',
    description: 'Joga razoavelmente, com alguns deslizes',
    depth: 2,
    timeBudgetMs: 250,
    blunderRate: 0.25,
  },
  strong: {
    label: 'Forte',
    description: 'Poucos erros e punição pesada',
    depth: 4,
    timeBudgetMs: 800,
    blunderRate: 0.05,
  },
  master: {
    label: 'Mestre',
    description: 'Busca profunda, sem piedade',
    depth: 6,
    timeBudgetMs: 2200,
    blunderRate: 0,
  },
};

/* ------------------------------------------------------------------ *
 * Tabelas de avaliação
 * ------------------------------------------------------------------ */

const PIECE_VALUE: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -25, -25, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 5, 5, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/* ------------------------------------------------------------------ *
 * Avaliação
 * ------------------------------------------------------------------ */

function evaluate(chess: Chess): number {
  const board = chess.board();
  let white = 0;
  let black = 0;
  let whiteBishops = 0;
  let blackBishops = 0;
  let whitePawnsOnFile = new Array(8).fill(0);
  let blackPawnsOnFile = new Array(8).fill(0);

  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const cell = board[rank][file];
      if (!cell) continue;
      const index = rank * 8 + file;
      const type = cell.type as PieceType;
      const value = PIECE_VALUE[type] + PST[type][index];

      if (cell.color === 'w') {
        white += value;
        if (type === 'b') whiteBishops += 1;
        if (type === 'p') whitePawnsOnFile[file] += 1;
      } else {
        black += value;
        if (type === 'b') blackBishops += 1;
        if (type === 'p') blackPawnsOnFile[file] += 1;
      }
    }
  }

  if (whiteBishops >= 2) white += 30;
  if (blackBishops >= 2) black += 30;

  for (let file = 0; file < 8; file += 1) {
    if (whitePawnsOnFile[file] > 1) white -= 15 * (whitePawnsOnFile[file] - 1);
    if (blackPawnsOnFile[file] > 1) black -= 15 * (blackPawnsOnFile[file] - 1);
  }

  const score = white - black;
  return chess.turn() === 'w' ? score : -score;
}

/* ------------------------------------------------------------------ *
 * Ordenação de lances (MVV-LVA)
 * ------------------------------------------------------------------ */

function moveScore(move: Move): number {
  let score = 0;
  if (move.captured) {
    const victim = PIECE_VALUE[move.captured as PieceType];
    const attacker = PIECE_VALUE[move.piece as PieceType];
    score += 10 * victim - attacker;
  }
  if (move.promotion) score += 900;
  return score;
}

/* ------------------------------------------------------------------ *
 * Busca
 * ------------------------------------------------------------------ */

const MATE = 100_000;
const MAX_QUIESCENCE = 4;

interface SearchResult {
  score: number;
  move: Move | null;
}

function quiescence(chess: Chess, alpha: number, beta: number, depth: number): number {
  const standPat = evaluate(chess);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (depth <= 0) return alpha;

  const moves = chess
    .moves({ verbose: true })
    .filter((move) => move.captured || move.promotion)
    .sort((a, b) => moveScore(b) - moveScore(a));

  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = -quiescence(chess, -beta, -alpha, depth - 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function negamax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  nodes: { count: number },
): number {
  nodes.count += 1;
  if ((nodes.count & 63) === 0 && Date.now() > deadline) {
    throw new TimeoutSignal();
  }

  if (depth === 0) return quiescence(chess, alpha, beta, MAX_QUIESCENCE);

  if (chess.isCheckmate()) return -MATE + (MAX_QUIESCENCE - depth);
  if (chess.isStalemate() || chess.isDraw()) return 0;

  const moves = chess.moves({ verbose: true }).sort((a, b) => moveScore(b) - moveScore(a));
  if (moves.length === 0) return -MATE;

  let best = -Infinity;
  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const score = -negamax(chess, depth - 1, -beta, -alpha, deadline, nodes);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

class TimeoutSignal extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutSignal';
  }
}

function searchRoot(chess: Chess, depth: number, deadline: number): SearchResult {
  const nodes = { count: 0 };
  const moves = chess.moves({ verbose: true }).sort((a, b) => moveScore(b) - moveScore(a));
  if (moves.length === 0) return { score: 0, move: null };

  let best: Move | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;

  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    let score: number;
    try {
      score = -negamax(chess, depth - 1, -Infinity, -alpha, deadline, nodes);
    } catch (error) {
      chess.undo();
      if (error instanceof TimeoutSignal) break;
      throw error;
    }
    chess.undo();
    if (score > bestScore) {
      bestScore = score;
      best = move;
      alpha = score;
    }
  }

  return { score: bestScore, move: best };
}

/* ------------------------------------------------------------------ *
 * Aleatoriedade determinística
 * ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * API pública
 * ------------------------------------------------------------------ */

/**
 * Escolhe um lance para o bot. Sempre devolve um lance legal.
 */
export function botMove(position: Position, options: BotOptions): BotMoveResult {
  const profile = BOT_PROFILES[options.difficulty] ?? BOT_PROFILES.casual;
  const budget = options.timeBudgetMs ?? profile.timeBudgetMs;
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(seed);

  const chess = new Chess(position.fen());
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) {
    throw new Error('Nenhum lance legal disponível.');
  }

  // Nível baixo: às vezes joga um lance claramente fraco de propósito.
  if (random() < profile.blunderRate && legal.length > 1) {
    const weak = legal.filter((move) => !move.captured && !move.promotion);
    const pool = weak.length > 0 ? weak : legal;
    const choice = pool[Math.floor(random() * pool.length)];
    return {
      from: choice.from,
      to: choice.to,
      promotion: choice.promotion,
      san: choice.san,
      score: 0,
    };
  }

  const deadline = Date.now() + budget;
  let result: SearchResult = { score: 0, move: legal[0] };

  for (let depth = 1; depth <= profile.depth; depth += 1) {
    try {
      const iteration = searchRoot(chess, depth, deadline);
      if (iteration.move) result = iteration;
      if (Date.now() > deadline) break;
    } catch (error) {
      if (error instanceof TimeoutSignal) break;
      throw error;
    }
  }

  const move = result.move ?? legal[0];
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    san: move.san,
    score: result.score,
  };
}
