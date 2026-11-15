/**
 * Leitura de FEN e ataque no tabuleiro.
 *
 * O componente do tabuleiro funciona sozinho, a partir do FEN: nao depende
 * do engine nem do servidor.
 */

export type PieceColor = 'w' | 'b';
export type PieceKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface BoardPiece {
  type: PieceKind;
  color: PieceColor;
}

export type BoardLayout = Record<string, BoardPiece>;

export interface ParsedFen {
  layout: BoardLayout;
  turn: PieceColor;
}

const KIND_BY_CHAR: Record<string, PieceKind> = {
  k: 'k',
  q: 'q',
  r: 'r',
  b: 'b',
  n: 'n',
  p: 'p',
};

/**
 * Le o campo de posicionamento de um FEN e devolve as casas ocupadas.
 * A cor vem do caso da letra: maiuscula e branca, minuscula e preta.
 * Fens invalidos devolvem um tabuleiro vazio em vez de lancar.
 */
export function parseFen(fen: string): ParsedFen {
  const layout: BoardLayout = {};
  const fields = fen.trim().split(/\s+/);
  const placement = fields[0] ?? '';
  const turn = (fields[1] === 'b' ? 'b' : 'w') as PieceColor;

  const rows = placement.split('/');
  if (rows.length !== 8) return { layout, turn };

  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    const row = rows[rowIndex];
    const rank = 8 - rowIndex;
    let file = 0;
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      const kind = KIND_BY_CHAR[char.toLowerCase()];
      if (!kind || file > 7) continue;
      const color: PieceColor = char === char.toUpperCase() ? 'w' : 'b';
      layout[`${'abcdefgh'[file]}${rank}`] = { type: kind, color };
      file += 1;
    }
  }

  return { layout, turn };
}

/** Cor oposta. */
export function oppositeColor(color: PieceColor): PieceColor {
  return color === 'w' ? 'b' : 'w';
}

const KNIGHT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];

const KING_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

const DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const ORTHOGONALS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const ALL_RAYS: ReadonlyArray<readonly [number, number]> = [
  ...DIAGONALS,
  ...ORTHOGONALS,
];

function toName(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${'abcdefgh'[file]}${rank + 1}`;
}

/** Casa onde esta o rei de uma cor. */
export function findKing(layout: BoardLayout, color: PieceColor): string | null {
  for (const [square, piece] of Object.entries(layout)) {
    if (piece.type === 'k' && piece.color === color) return square;
  }
  return null;
}

/**
 * Uma casa esta atacada quando alguma peca da cor `by` alcanca ela.
 *
 * A deteccao e geometrica: nao considera o peao en passant e nao desconta
 * pecas presas. Serve para marcar o xeque, nao para validar lances.
 */
export function isSquareAttacked(
  layout: BoardLayout,
  square: string,
  by: PieceColor,
): boolean {
  const targetFile = square.charCodeAt(0) - 97;
  const targetRank = square.charCodeAt(1) - 49;

  for (const [origin, piece] of Object.entries(layout)) {
    if (piece.color !== by) continue;
    const file = origin.charCodeAt(0) - 97;
    const rank = origin.charCodeAt(1) - 49;
    const df = targetFile - file;
    const dr = targetRank - rank;

    switch (piece.type) {
      case 'p': {
        const forward = by === 'w' ? 1 : -1;
        if (dr === forward && Math.abs(df) === 1) return true;
        break;
      }
      case 'n': {
        if (KNIGHT_OFFSETS.some(([of, or]) => of === df && or === dr)) return true;
        break;
      }
      case 'k': {
        if (KING_OFFSETS.some(([of, or]) => of === df && or === dr)) return true;
        break;
      }
      case 'b':
      case 'r':
      case 'q': {
        const diagonal = df !== 0 && dr !== 0 && Math.abs(df) === Math.abs(dr);
        const straight = (df === 0) !== (dr === 0);
        const eligible =
          piece.type === 'q'
            ? diagonal || straight
            : piece.type === 'b'
              ? diagonal
              : straight;
        if (!eligible) break;
        const rays = piece.type === 'r' ? ORTHOGONALS : piece.type === 'b' ? DIAGONALS : ALL_RAYS;
        if (slidingRayReaches(layout, file, rank, df, dr, rays, targetFile, targetRank)) {
          return true;
        }
        break;
      }
      default:
        break;
    }
  }

  return false;
}

/**
 * Percorre a raia a partir da peca e devolve true quando a casa alvo e
 * alcancada sem peca no caminho.
 */
function slidingRayReaches(
  layout: BoardLayout,
  file: number,
  rank: number,
  df: number,
  dr: number,
  rays: ReadonlyArray<readonly [number, number]>,
  targetFile: number,
  targetRank: number,
): boolean {
  const stepFile = Math.sign(df);
  const stepRank = Math.sign(dr);
  const ray = rays.some(([of, or]) => of === stepFile && or === stepRank);
  if (!ray) return false;

  let currentFile = file + stepFile;
  let currentRank = rank + stepRank;
  while (currentFile >= 0 && currentFile <= 7 && currentRank >= 0 && currentRank <= 7) {
    if (currentFile === targetFile && currentRank === targetRank) return true;
    const name = toName(currentFile, currentRank);
    if (name && layout[name]) return false;
    currentFile += stepFile;
    currentRank += stepRank;
  }
  return false;
}
