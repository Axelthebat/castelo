import { Chess } from 'chess.js';
import type { Color, PieceType } from './types.ts';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Valida um FEN usando o validador do chess.js. */
export function isValidFen(fen: string): boolean {
  if (typeof fen !== 'string' || fen.trim() === '') return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function describeFen(fen: string): { turn: Color; inCheck: boolean; legalMoveCount: number } {
  const chess = new Chess(fen);
  return {
    turn: chess.turn(),
    inCheck: chess.inCheck(),
    legalMoveCount: chess.moves().length,
  };
}

export function pieceTypeOf(symbol: string): PieceType {
  const map: Record<string, PieceType> = {
    k: 'k',
    q: 'q',
    r: 'r',
    b: 'b',
    n: 'n',
    p: 'p',
  };
  const type = map[symbol];
  if (!type) throw new Error(`Peça desconhecida: ${symbol}`);
  return type;
}
