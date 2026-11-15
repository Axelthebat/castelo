/**
 * Elo padrão (K fixo). Réplica mínima do `eloUpdate` do @castelo/engine,
 * mantida localmente até o engine ter a função disponível (o engine é puro
 * e síncrono; esta implementação não faz I/O).
 */

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function eloUpdate(
  rating: number,
  opponentRating: number,
  score: number,
  kFactor = 32,
): number {
  return Math.round(rating + kFactor * (score - expectedScore(rating, opponentRating)));
}

export function scoreForResult(result: GameResult | null, perspective: 'w' | 'b'): number {
  if (result === null || result === '*') return 0.5;
  if (result === '1/2-1/2') return 0.5;
  const whiteWon = result === '1-0';
  const won = perspective === 'w' ? whiteWon : !whiteWon;
  return won ? 1 : 0;
}
