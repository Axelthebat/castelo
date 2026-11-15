import type { GameResult } from './types.ts';

export interface EloResult {
  white: number;
  black: number;
  expectedWhite: number;
}

/** K-factor conforme a faixa de rating (regra clássica da FIDE simplificada). */
export function kFactor(rating: number): number {
  if (rating < 2100) return 40;
  if (rating < 2400) return 20;
  return 10;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function eloUpdate(
  whiteRating: number,
  blackRating: number,
  result: GameResult,
  k?: number,
): EloResult {
  const scoreWhite = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
  const expectedWhite = expectedScore(whiteRating, blackRating);
  const kFactorWhite = k ?? kFactor(whiteRating);
  const kFactorBlack = k ?? kFactor(blackRating);

  const white = Math.round(whiteRating + kFactorWhite * (scoreWhite - expectedWhite));
  const black = Math.round(blackRating + kFactorBlack * (1 - scoreWhite - (1 - expectedWhite)));

  return { white, black, expectedWhite };
}
