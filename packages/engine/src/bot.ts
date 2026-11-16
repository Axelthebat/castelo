import { Chess } from 'chess.js';
import type { Position } from './position.ts';
import type { PieceType } from './types.ts';
import {
  Board,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  COLOR_OFFSET,
  colorOf,
  type InternalMove,
} from './board.ts';

export type BotDifficulty = 'beginner' | 'casual' | 'strong' | 'master';

export interface BotOptions {
  difficulty: BotDifficulty;
  /** tempo máximo de cálculo por lance, em ms */
  timeBudgetMs?: number;
  /** semente para repetibilidade (tests) */
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
  /** profundidade máxima da busca */
  depth: number;
  timeBudgetMs: number;
  /** probabilidade de escolher um lance abaixo do melhor */
  blunderRate: number;
  /**
   * Margem de erro, em centipontos: lances piores que isso nunca são
   * escolhidos, o que impede o nível iniciante de pendurar peça de graça.
   */
  noise: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  beginner: {
    label: 'Aprendiz',
    description: 'Erra bastante — ideal para começar',
    depth: 2,
    timeBudgetMs: 200,
    blunderRate: 0.72,
    noise: 240,
  },
  casual: {
    label: 'Casual',
    description: 'Joga razoavelmente, com alguns deslizes',
    depth: 4,
    timeBudgetMs: 500,
    blunderRate: 0.38,
    noise: 85,
  },
  strong: {
    label: 'Forte',
    description: 'Poucos erros, e pune os seus deslizes',
    depth: 7,
    timeBudgetMs: 1100,
    blunderRate: 0.1,
    noise: 22,
  },
  master: {
    label: 'Mestre',
    description: 'Busca profunda, sem piedade',
    depth: 14,
    timeBudgetMs: 2000,
    blunderRate: 0,
    noise: 0,
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

/** Valores em centipontos, na perspectiva do branco (linha 0 = rank 8). */
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    70, 70, 70, 70, 70, 70, 70, 70,
    14, 16, 24, 34, 34, 24, 16, 14,
    6, 10, 16, 30, 30, 16, 10, 6,
    2, 2, 6, 24, 24, 6, 2, 2,
    6, -2, -6, 2, 2, -6, -2, 6,
    6, 12, 12, -22, -22, 12, 12, 6,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -54, -44, -34, -34, -34, -34, -44, -54,
    -44, -20, 2, 6, 6, 2, -20, -44,
    -30, 4, 16, 22, 22, 16, 4, -30,
    -30, 10, 22, 28, 28, 22, 10, -30,
    -30, 6, 20, 28, 28, 20, 6, -30,
    -30, 4, 14, 20, 20, 14, 4, -30,
    -44, -18, 4, 10, 10, 4, -18, -44,
    -54, -42, -32, -32, -32, -32, -42, -54,
  ],
  b: [
    -22, -12, -12, -12, -12, -12, -12, -22,
    -12, 2, 2, 2, 2, 2, 2, -12,
    -12, 8, 12, 12, 12, 12, 8, -12,
    -12, 6, 12, 16, 16, 12, 6, -12,
    -12, 4, 14, 16, 16, 14, 4, -12,
    -12, 12, 12, 12, 12, 12, 12, -12,
    -12, 10, 2, 2, 2, 2, 10, -12,
    -22, -12, -12, -12, -12, -12, -12, -22,
  ],
  r: [
    2, 2, 4, 6, 6, 4, 2, 2,
    10, 16, 16, 16, 16, 16, 16, 10,
    -2, 2, 2, 2, 2, 2, 2, -2,
    -2, 2, 2, 2, 2, 2, 2, -2,
    -2, 2, 2, 2, 2, 2, 2, -2,
    -2, 2, 2, 2, 2, 2, 2, -2,
    -2, 2, 2, 2, 2, 2, 2, -2,
    0, 2, 6, 8, 8, 6, 2, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 2, 4, 4, 4, 4, 2, -10,
    -10, 4, 8, 8, 8, 8, 4, -10,
    -5, 4, 8, 8, 8, 8, 4, -5,
    0, 4, 8, 8, 8, 8, 4, 0,
    -10, 8, 8, 8, 8, 8, 4, -10,
    -10, 6, 4, 4, 4, 4, 2, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -32, -42, -42, -52, -52, -42, -42, -32,
    -32, -42, -42, -52, -52, -42, -42, -32,
    -32, -42, -42, -52, -52, -42, -42, -32,
    -32, -42, -42, -52, -52, -42, -42, -32,
    -22, -32, -32, -42, -42, -32, -32, -22,
    -12, -22, -22, -22, -22, -22, -22, -12,
    22, 22, 2, 2, 2, 2, 22, 22,
    20, 32, 12, 2, 2, 12, 32, 20,
  ],
};

/** Bônus de peão passado, por avanço (0 = na casa inicial). */
const PASSED_BONUS = [0, 6, 16, 34, 62, 104, 160, 0];

/* ------------------------------------------------------------------ *
 * Avaliação sobre o tabuleiro interno
 * ------------------------------------------------------------------ */

const TYPE_OF = [0, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING];

function evaluate(board: Board): number {
  const squares = board.squares;
  let white = 0;
  let black = 0;

  const pawnRanks: number[][] = [[], [], [], [], [], [], [], []];
  const pawnFiles = [0, 0, 0, 0, 0, 0, 0, 0];
  const blackPawnRanks: number[][] = [[], [], [], [], [], [], [], []];
  const blackPawnFiles = [0, 0, 0, 0, 0, 0, 0, 0];
  let whiteBishops = 0;
  let blackBishops = 0;
  let whiteKing = -1;
  let blackKing = -1;

  for (let index = 0; index < 64; index += 1) {
    const piece = squares[index];
    if (piece === 0) continue;
    const type = piece % COLOR_OFFSET;
    const row = index >> 3;
    const file = index & 7;
    const isWhite = colorOf(piece) === 0;
    const pstIndex = isWhite ? (7 - row) * 8 + file : row * 8 + file;

    const value =
      (TYPE_OF[type] === PAWN
        ? PIECE_VALUE.p
        : TYPE_OF[type] === KNIGHT
          ? PIECE_VALUE.n
          : TYPE_OF[type] === BISHOP
            ? PIECE_VALUE.b
            : TYPE_OF[type] === ROOK
              ? PIECE_VALUE.r
              : TYPE_OF[type] === QUEEN
                ? PIECE_VALUE.q
                : PIECE_VALUE.k) +
      PST[pieceTypeName(type)][pstIndex];

    if (isWhite) {
      white += value;
      if (type === PAWN) {
        pawnRanks[file].push(row);
        pawnFiles[file] += 1;
      }
      if (type === BISHOP) whiteBishops += 1;
      if (type === KING) whiteKing = index;
    } else {
      black += value;
      if (type === PAWN) {
        blackPawnRanks[file].push(row);
        blackPawnFiles[file] += 1;
      }
      if (type === BISHOP) blackBishops += 1;
      if (type === KING) blackKing = index;
    }
  }

  if (whiteBishops >= 2) white += 36;
  if (blackBishops >= 2) black += 36;

  for (let file = 0; file < 8; file += 1) {
    if (pawnFiles[file] > 1) white -= 18 * (pawnFiles[file] - 1);
    if (blackPawnFiles[file] > 1) black -= 18 * (blackPawnFiles[file] - 1);

    const wLeft = file > 0 ? pawnFiles[file - 1] : 0;
    const wRight = file < 7 ? pawnFiles[file + 1] : 0;
    const bLeft = file > 0 ? blackPawnFiles[file - 1] : 0;
    const bRight = file < 7 ? blackPawnFiles[file + 1] : 0;

    if (pawnFiles[file] > 0 && wLeft === 0 && wRight === 0) white -= 16;
    if (blackPawnFiles[file] > 0 && bLeft === 0 && bRight === 0) black -= 16;

    for (const row of pawnRanks[file]) {
      let passed = true;
      for (let neighbour = Math.max(0, file - 1); neighbour <= Math.min(7, file + 1); neighbour += 1) {
        for (const enemyRow of blackPawnRanks[neighbour]) {
          if (enemyRow < row) passed = false;
        }
      }
      if (passed) white += PASSED_BONUS[Math.min(7, row)];
    }

    for (const row of blackPawnRanks[file]) {
      let passed = true;
      for (let neighbour = Math.max(0, file - 1); neighbour <= Math.min(7, file + 1); neighbour += 1) {
        for (const enemyRow of pawnRanks[neighbour]) {
          if (enemyRow > row) passed = false;
        }
      }
      if (passed) black += PASSED_BONUS[Math.min(7, 7 - row)];
    }
  }

  white += kingShield(whiteKing, pawnRanks);
  black += kingShield(blackKing, blackPawnRanks);

  const score = white - black;
  return board.turn === 0 ? score + 14 : -score + 14;
}

function pieceTypeName(type: number): PieceType {
  if (type === PAWN) return 'p';
  if (type === KNIGHT) return 'n';
  if (type === BISHOP) return 'b';
  if (type === ROOK) return 'r';
  if (type === QUEEN) return 'q';
  return 'k';
}

function kingShield(kingSquare: number, pawnRanks: number[][]): number {
  if (kingSquare < 0) return 0;
  const kingRow = kingSquare >> 3;
  const kingFile = kingSquare & 7;
  let shield = 0;
  for (let file = Math.max(0, kingFile - 1); file <= Math.min(7, kingFile + 1); file += 1) {
    for (const row of pawnRanks[file]) {
      const distance = kingRow - row;
      if (distance > 0 && distance <= 2) shield += distance === 1 ? 16 : 7;
    }
  }
  return shield;
}

/* ------------------------------------------------------------------ *
 * Ordenação
 * ------------------------------------------------------------------ */

function squareName(index: number): string {
  return 'abcdefgh'[index & 7] + String((index >> 3) + 1);
}

function moveKey(move: InternalMove): string {
  return `${move.from}-${move.to}-${move.promotion}`;
}

function captureValue(move: InternalMove): number {
  if (move.captured !== 0) {
    const victim = PIECE_VALUE[pieceTypeName(move.captured % COLOR_OFFSET)];
    const attacker = PIECE_VALUE[pieceTypeName(move.piece % COLOR_OFFSET)];
    return 10 * victim - attacker + 1_000_000;
  }
  if (move.promotion !== 0) return 900_000 + PIECE_VALUE[pieceTypeName(move.promotion)];
  return 0;
}

/* ------------------------------------------------------------------ *
 * Contexto da busca
 * ------------------------------------------------------------------ */

interface TTEntry {
  hashLo: number;
  depth: number;
  /** 0 = exato, 1 = limite inferior, 2 = limite superior */
  flag: 0 | 1 | 2;
  score: number;
  move: string | null;
}

const TT_LIMIT = 400_000;
const MATE = 100_000;

class SearchContext {
  readonly tt = new Map<number, TTEntry>();
  readonly killers: (string | null)[][] = [];
  readonly history = new Map<string, number>();
  nodes = 0;
  deadline = 0;
  timedOut = false;

  checkTime(): void {
    this.nodes += 1;
    if ((this.nodes & 511) === 0 && Date.now() > this.deadline) {
      this.timedOut = true;
    }
  }
}

function adjustMateScore(score: number, delta: number): number {
  if (score > MATE - 1000) return score + delta;
  if (score < -MATE + 1000) return score - delta;
  return score;
}

/* ------------------------------------------------------------------ *
 * Quiescência
 * ------------------------------------------------------------------ */

function quiescence(board: Board, alpha: number, beta: number, ctx: SearchContext): number {
  ctx.checkTime();
  if (ctx.timedOut) return 0;

  const standPat = evaluate(board);
  if (standPat >= beta) return standPat;
  if (standPat > alpha) alpha = standPat;

  const captures = board.generateLegalCaptures([]);
  captures.sort((a, b) => captureValue(b) - captureValue(a));

  for (const move of captures) {
    board.makeMove(move);
    const score = -quiescence(board, -beta, -alpha, ctx);
    board.unmakeMove();
    if (ctx.timedOut) return 0;
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/* ------------------------------------------------------------------ *
 * Negamax com PVS, tabela de transposição, killers e histórico
 * ------------------------------------------------------------------ */

const moveBuffer: InternalMove[] = [];

function orderMoves(
  moves: InternalMove[],
  ctx: SearchContext,
  ply: number,
  ttMove: string | null,
): InternalMove[] {
  const killer = ctx.killers[ply] ?? [];
  const scored = moves.map((move) => {
    const key = moveKey(move);
    let score = captureValue(move);
    if (ttMove && key === ttMove) score += 8_000_000;
    else if (killer[0] === key) score += 600_000;
    else if (killer[1] === key) score += 300_000;
    else if (move.captured === 0 && move.promotion === 0) score += ctx.history.get(key) ?? 0;
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.move);
}

function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchContext,
): number {
  ctx.checkTime();
  if (ctx.timedOut) return 0;

  const isPv = beta - alpha > 1;
  const alphaStart = alpha;
  const key = board.hashHi;

  let ttMove: string | null = null;
  const entry = ctx.tt.get(key);
  if (entry && entry.hashLo === board.hashLo) {
    ttMove = entry.move;
    if (!isPv && entry.depth >= depth) {
      const score = adjustMateScore(entry.score, -ply);
      if (entry.flag === 0) return score;
      if (entry.flag === 1 && score <= alpha) return score;
      if (entry.flag === 2 && score >= beta) return score;
    }
  }

  const side = board.turn;
  const inCheck = board.isAttacked(board.kingSquare[side], 1 - side);
  const searchDepth = inCheck ? depth + 1 : depth;

  if (searchDepth <= 0) return quiescence(board, alpha, beta, ctx);

  const moves = orderMoves(board.generateLegal(moveBuffer), ctx, ply, ttMove);
  if (moves.length === 0) {
    return inCheck ? -MATE + ply : 0;
  }

  // Corte de futility nas camadas rasas.
  if (!isPv && !inCheck && searchDepth <= 3) {
    const staticEval = evaluate(board);
    if (staticEval + 130 * searchDepth <= alpha) return staticEval;
  }

  let best = -Infinity;
  let bestKey: string | null = null;
  let searched = 0;

  for (const move of moves) {
    searched += 1;
    board.makeMove(move);
    let score: number;
    if (searched === 1) {
      score = -negamax(board, searchDepth - 1, -beta, -alpha, ply + 1, ctx);
    } else {
      const reduction =
        !inCheck && searched > 6 && searchDepth >= 3 && move.captured === 0 && move.promotion === 0
          ? 1
          : 0;
      score = -negamax(board, searchDepth - 1 - reduction, -alpha - 1, -alpha, ply + 1, ctx);
      if (!ctx.timedOut && score > alpha && score < beta) {
        score = -negamax(board, searchDepth - 1, -beta, -alpha, ply + 1, ctx);
      }
    }
    board.unmakeMove();
    if (ctx.timedOut) return 0;

    if (score > best) {
      best = score;
      bestKey = moveKey(move);
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (move.captured === 0 && move.promotion === 0) {
        const slot = ctx.killers[ply] ?? [];
        ctx.killers[ply] = [bestKey, slot[0] ?? null];
        const historyKey = moveKey(move);
        ctx.history.set(historyKey, (ctx.history.get(historyKey) ?? 0) + searchDepth * searchDepth);
      }
      break;
    }
  }

  const flag: 0 | 1 | 2 = best <= alphaStart ? 2 : best >= beta ? 1 : 0;
  if (ctx.tt.size >= TT_LIMIT) ctx.tt.clear();
  ctx.tt.set(key, {
    hashLo: board.hashLo,
    depth: searchDepth,
    flag,
    score: adjustMateScore(best, ply),
    move: bestKey,
  });

  return best;
}

/* ------------------------------------------------------------------ *
 * Raiz
 * ------------------------------------------------------------------ */

interface ScoredMove {
  move: InternalMove;
  score: number;
}

function searchRoot(
  board: Board,
  depth: number,
  ctx: SearchContext,
): ScoredMove[] {
  const moves = orderMoves(board.generateLegal(moveBuffer), ctx, 0, null);
  const results: ScoredMove[] = [];

  for (const move of moves) {
    board.makeMove(move);
    const score = -negamax(board, depth - 1, -Infinity, Infinity, 1, ctx);
    board.unmakeMove();
    if (ctx.timedOut) break;
    results.push({ move, score });
  }

  return results;
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
 *
 * A dificuldade é controlada por dois parâmetros: a profundidade da busca e
 * a margem de erro (`noise`). Níveis fracos não jogam lance aleatório — eles
 * escolhem entre os lances que a busca considera aceitáveis, o que produz
 * erros humanos em vez de erros absurdos.
 */
export function botMove(position: Position, options: BotOptions): BotMoveResult {
  const profile = BOT_PROFILES[options.difficulty] ?? BOT_PROFILES.casual;
  const budget = options.timeBudgetMs ?? profile.timeBudgetMs;
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(seed);

  const fen = position.fen();
  const board = new Board(fen);
  const legal = board.generateLegal([]);
  if (legal.length === 0) {
    throw new Error('Nenhum lance legal disponível.');
  }

  const ctx = new SearchContext();
  ctx.deadline = Date.now() + budget;

  let scored: ScoredMove[] = [];
  for (let depth = 1; depth <= profile.depth; depth += 1) {
    const iteration = searchRoot(board, depth, ctx);
    if (iteration.length > 0 && !ctx.timedOut) {
      scored = iteration;
    }
    if (ctx.timedOut || Date.now() > ctx.deadline) break;
  }

  if (scored.length === 0) {
    return toResult(legal[0], 0, fen);
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const bestScore = best.score;

  const acceptable = scored.filter((entry) => entry.score >= bestScore - profile.noise);
  const alternatives = acceptable.filter((entry) => entry.score < bestScore);

  let chosen = best;
  if (alternatives.length > 0 && random() < profile.blunderRate) {
    chosen = alternatives[Math.floor(random() * alternatives.length)];
  }

  return toResult(chosen.move, chosen.score, fen);
}

/** Profundidade e nós da última busca — usado nos testes e no diagnóstico. */
export function botSearchStats(
  position: Position,
  options: BotOptions,
): { depth: number; nodes: number; best: string } {
  const profile = BOT_PROFILES[options.difficulty] ?? BOT_PROFILES.casual;
  const board = new Board(position.fen());
  const ctx = new SearchContext();
  ctx.deadline = Date.now() + (options.timeBudgetMs ?? profile.timeBudgetMs);

  let depth = 0;
  let best = '';
  for (let d = 1; d <= profile.depth; d += 1) {
    const iteration = searchRoot(board, d, ctx);
    if (iteration.length === 0) break;
    const sorted = [...iteration].sort((a, b) => b.score - a.score);
    best = squareName(sorted[0].move.from) + squareName(sorted[0].move.to);
    if (ctx.timedOut) break;
    depth = d;
  }
  return { depth, nodes: ctx.nodes, best };
}

function toResult(move: InternalMove, score: number, fen: string): BotMoveResult {
  const from = squareName(move.from);
  const to = squareName(move.to);
  const promotion = move.promotion !== 0 ? pieceTypeName(move.promotion) : undefined;

  // A notação vem do chess.js: ele cuida de desambiguação, de xeque e de mate.
  let san = `${from}${to}`;
  try {
    const chess = new Chess(fen);
    const applied = chess.move({ from, to, promotion });
    if (applied) san = applied.san;
  } catch {
    // Na impossibilidade de gerar a notação, vale a forma longa.
  }

  return { from, to, promotion, san, score };
}
