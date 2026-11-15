/**
 * Conjunto de pecas do Castelo.
 *
 * Geometria original: formas planas, duas tonalidades, contorno unico.
 * As pecas nao carregam cor no codigo: cada grupo `.piece-*` define
 * `--piece-fill`, `--piece-stroke` e `--piece-shade`, entao um tema novo
 * e so um novo grupo de custom properties.
 *
 * Todas as pecas usam a mesma viewBox (45 x 45), o mesmo espessura de
 * contorno e a mesma base (y de 37.5 a 41), para que a fileira de pecas
 * forme uma linha unica.
 */

export type PieceKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface PieceGeometry {
  /** Silhueta: preenchida com `--piece-fill`, contornada com `--piece-stroke`. */
  body: string[];
  /** Regiao de sombra, recortada pela propria silhueta. */
  shade: string;
  /** Tracos internos, apenas contorno. */
  detail: string[];
}

/** Base comum a todas as pecas. */
const BASE = 'M12 41 L14.5 37.5 H30.5 L33 41 Z';

/**
 * Sombra padrao: a luz vem do alto a esquerda, entao a regiao escura e a
 * fatia a direita da diagonal. Recortada pela silhueta, nunca vaza.
 */
const SHADE = 'M26 0 H45 V45 H18 Z';

export const PIECE_GEOMETRY: Record<PieceKind, PieceGeometry> = {
  /* Peao: base, haste, colarinho e esfera. */
  p: {
    body: [
      'M16.7 16.6 a5.8 5.8 0 1 0 11.6 0 a5.8 5.8 0 1 0 -11.6 0 Z',
      'M17.8 23.2 H27.2 L26 25.6 H19 Z',
      'M19.6 25.6 L18.6 37.5 H26.4 L25.4 25.6 Z',
      BASE,
    ],
    shade: SHADE,
    detail: [],
  },

  /* Torre: corpo, faixa e tres ameias. */
  r: {
    body: [
      'M16 16.5 V10.5 H19 V13.5 H22 V10.5 H25 V13.5 H28 V10.5 H31 V16.5 Z',
      'M16 16.5 H29 V37.5 H16 Z',
      BASE,
    ],
    shade: SHADE,
    detail: ['M16 29.4 H29'],
  },

  /* Bispo: mitra, colarinho e corpo estreito. */
  b: {
    body: [
      'M22.5 5.4 L28.4 14.6 C29.2 19.2 26.5 22.4 22.5 22.4 C18.5 22.4 15.8 19.2 16.6 14.6 Z',
      'M17.4 19.4 H27.6 L26.2 22.4 H18.8 Z',
      'M16.8 37.5 L19 22.4 H26 L28.2 37.5 Z',
      BASE,
    ],
    shade: SHADE,
    detail: ['M22.5 9.6 V15.4'],
  },

  /* Cavalo: cabeca de perfil com orelha e crina. */
  n: {
    body: [
      'M23.2 4.8 L25.6 11.4 L29.2 9.2 L29.8 14.6 L26.6 18.2 L25.2 24.4 L27.2 37.5 H16.4 L17.9 27.6 L19.4 21.6 L14.8 19 L12.6 14.4 L15.6 9.4 L20.4 7.4 Z',
      BASE,
    ],
    shade: SHADE,
    detail: ['M13.9 15.4 L17.2 16.6'],
  },

  /* Rainha: coroa de cinco pontas com esferas. */
  q: {
    body: [
      'M11 15.4 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z',
      'M16 22.2 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z',
      'M20.3 11 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z',
      'M24.6 22.2 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z',
      'M29.6 15.4 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z',
      'M14.6 30.4 L13.2 17.6 L18.2 24.4 L22.5 13.2 L26.8 24.4 L31.8 17.6 L30.4 30.4 Z',
      'M15.4 37.5 L14.6 30.4 H30.4 L29.6 37.5 Z',
      BASE,
    ],
    shade: SHADE,
    detail: ['M14.8 33.2 H30.2'],
  },

  /* Rei: cruz sobre uma coroa de tres pontas. */
  k: {
    body: [
      'M21 16 V5 H24 V8.6 H27.6 V11.6 H24 V16 Z',
      'M16.8 28.6 L14.4 21.4 L18.6 24.2 L21 16 H24 L26.4 24.2 L30.6 21.4 L28.2 28.6 Z',
      'M15.8 37.5 L16.8 28.6 H28.2 L29.2 37.5 Z',
      BASE,
    ],
    shade: SHADE,
    detail: ['M15.9 31.6 H29.1'],
  },
};

export const PIECE_VIEW_BOX = '0 0 45 45';
export const PIECE_STROKE_WIDTH = 1.6;

/** Nomes em portugues, para os rotulos acessiveis das casas. */
export const PIECE_LABELS: Record<PieceKind, string> = {
  k: 'rei',
  q: 'rainha',
  r: 'torre',
  b: 'bispo',
  n: 'cavalo',
  p: 'peão',
};
