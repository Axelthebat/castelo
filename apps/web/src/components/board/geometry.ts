/**
 * Geometria do tabuleiro.
 *
 * Modulo puro, sem dependencias, para poder ser importado tambem pelo
 * script de verificacao `apps/web/scripts/verify-board.mjs`.
 *
 * Convencao: a1 e a casa escura, h1 e clara. A file `a` vale 0 e o rank
 * `1` vale 1, entao a casa e escura quando (file + rank) e impar.
 */

export type BoardOrientation = 'w' | 'b';
export type SquareTone = 'light' | 'dark';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export const FILE_NAMES = FILES;
export const RANK_NAMES = RANKS;

/** Quantidade de casas de um tabuleiro. */
export const SQUARE_COUNT = 64;

/** True quando a string tem o formato `a1` ate `h8`. */
export function isSquare(value: string): boolean {
  if (value.length !== 2) return false;
  const file = value.charCodeAt(0);
  const rank = value.charCodeAt(1);
  return file >= 97 && file <= 104 && rank >= 49 && rank <= 56;
}

/** Cor de fundo da casa. `a1` e escura. */
export function squareColorAt(square: string): SquareTone {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return (file + rank) % 2 === 0 ? 'dark' : 'light';
}

/** Converte a casa em coordenadas de tela (file, rank) comecando em a1. */
export function squareToFileRank(square: string): { file: number; rank: number } {
  return { file: square.charCodeAt(0) - 97, rank: square.charCodeAt(1) - 49 };
}

/** Converte coordenadas de tela em casa. */
export function fileRankToSquare(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}`;
}

/**
 * As 64 casas na ordem de leitura da grade, ja conforme a orientacao.
 * Em `w` a primeira casa e a8 e a ultima e h1; em `b` o inverso.
 */
export function boardSquares(orientation: BoardOrientation): string[] {
  const squares: string[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      squares.push(squareAt(row, col, orientation) as string);
    }
  }
  return squares;
}

/**
 * Casa na posicao (linha, coluna) da grade ja orientada.
 * Linha 0 e o topo da tela, coluna 0 e a esquerda.
 */
export function squareAt(
  row: number,
  col: number,
  orientation: BoardOrientation,
): string | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  const flipped = orientation === 'b';
  const rank = flipped ? row : 7 - row;
  const file = flipped ? 7 - col : col;
  return fileRankToSquare(file, rank);
}

/** Posicao (linha, coluna) da casa dentro da grade orientada. */
export function squarePosition(
  square: string,
  orientation: BoardOrientation,
): { row: number; col: number } {
  const { file, rank } = squareToFileRank(square);
  const flipped = orientation === 'b';
  return {
    row: flipped ? rank : 7 - rank,
    col: flipped ? 7 - file : file,
  };
}
