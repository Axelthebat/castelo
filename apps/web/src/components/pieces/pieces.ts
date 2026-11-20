/**
 * Conjunto de peças do Castelo — "Arquivo".
 *
 * Silhuetas fiéis ao conjunto de Cburnett (Wikimedia Commons, CC BY-SA 3.0):
 * https://commons.wikimedia.org/wiki/Category:Cburnett_chess_sets
 * Crédito integral em docs/DECISOES.md. Os paths foram adaptados ao sistema
 * de temas do Castelo: as cores não vivem aqui, mas em `--piece-fill`,
 * `--piece-stroke` e `--piece-shade`, definidos por `.piece-white` / `.piece-black`.
 * A sombra em dois tons é a assinatura "Arquivo" que nos diferencia da referência.
 *
 * Todas as peças usam a mesma viewBox (45×45), o mesmo contorno (1.5) e a
 * mesma faixa de base (y 36–39.5), de modo que a fileira forme uma linha única.
 */

export type PieceKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface PieceGeometry {
  /** Silhuetas preenchidas com `--piece-fill` e contornadas com `--piece-stroke`. */
  body: string[];
  /** Região de sombra, recortada pela própria silhueta (nunca vaza). */
  shade: string;
  /** Traços internos, apenas contorno. */
  detail: string[];
  /** Pontos sólidos na cor do contorno (olho e nariz do cavalo). */
  marks?: string[];
}

/** Luz do alto à esquerda: a fatia escura fica à direita. */
const SHADE = 'M26 0 H45 V45 H18 Z';

/** Círculo centrado em (cx, cy), escrito com arcos SVG. */
function ball(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 -${r * 2} 0 Z`;
}

export const PIECE_GEOMETRY: Record<PieceKind, PieceGeometry> = {
  /* Peão: esfera, colarinho e corpo afunilado. */
  p: {
    body: [
      'M22 9 C19.79 9 18 10.79 18 13 C18 13.89 18.29 14.71 18.78 15.38 C16.83 16.5 15.5 18.59 15.5 21 C15.5 23.03 16.44 24.84 17.91 26.03 C14.91 27.09 10.5 31.58 10.5 39.5 L33.5 39.5 C33.5 31.58 29.09 27.09 26.09 26.03 C27.56 24.84 28.5 23.03 28.5 21 C28.5 18.59 27.17 16.5 25.22 15.38 C25.71 14.71 26 13.89 26 13 C26 10.79 24.21 9 22 9 Z',
    ],
    shade: SHADE,
    detail: [],
  },

  /* Torre: ameias, faixa e corpo ligeiramente afunilado. */
  r: {
    body: [
      'M9 39 L36 39 L36 36 L9 36 Z',
      'M12 36 L12 32 L33 32 L33 36 Z',
      'M11 14 L11 9 L15 9 L15 11 L20 11 L20 9 L25 9 L25 11 L30 11 L30 9 L34 9 L34 14 Z',
      'M34 14 L31 17 L14 17 L11 14 Z',
      'M31 17 L31 29.5 L14 29.5 L14 17 Z',
      'M31 29.5 L32.5 32 L12.5 32 L14 29.5 Z',
    ],
    shade: SHADE,
    detail: ['M11 14 L34 14'],
  },

  /* Bispo: mitra com esfera no topo, fenda e base em degraus. */
  b: {
    body: [
      'M9 36 C12.39 35.03 19.11 36.43 22.5 34 C25.89 36.43 32.61 35.03 36 36 C36 36 37.65 36.54 39 38 C38.32 38.97 37.35 38.99 36 38.5 C32.61 37.53 25.89 38.96 22.5 37.5 C19.11 38.96 12.39 37.53 9 38.5 C7.646 38.99 6.677 38.97 6 38 C7.354 36.06 9 36 9 36 Z',
      'M15 32 C17.5 34.5 27.5 34.5 30 32 C30.5 30.5 30 30 30 30 C30 27.5 27.5 26 27.5 26 C33 24.5 33.5 14.5 22.5 10.5 C11.5 14.5 12 24.5 17.5 26 C17.5 26 15 27.5 15 30 C15 30 14.5 30.5 15 32 Z',
      ball(22.5, 8, 2.5),
    ],
    shade: SHADE,
    detail: [
      'M17.5 26 L27.5 26',
      'M15 30 L30 30',
      'M22.5 15.5 L22.5 20.5',
      'M20 18 L25 18',
    ],
  },

  /* Cavalo: uma orelha, focinho longo, olho e nariz — idêntico à referência. */
  n: {
    body: [
      'M22 10 C32.5 11 38.5 18 38 39 L15 39 C15 30 25 32.5 23 18 Z',
      'M24 18 C24.38 20.91 18.45 25.37 16 27 C13 29 13.18 31.34 11 31 C9.958 30.06 12.41 27.96 11 28 C10 28 11.19 29.23 10 30 C9 30 5.997 31 6 26 C6 24 12 14 12 14 C12 14 13.89 12.1 14 10.5 C13.27 9.506 13.5 8.5 13.5 7.5 C14.5 6.5 16.5 10 16.5 10 L18.5 10 C18.5 10 19.28 8.008 21 7 C22 7 22 10 22 10 Z',
    ],
    shade: SHADE,
    detail: [],
    marks: [
      'M9.5 25.5 A0.5 0.5 0 1 1 8.5 25.5 A0.5 0.5 0 1 1 9.5 25.5 Z',
      'M15 15.5 A0.5 1.5 0 1 1 14 15.5 A0.5 1.5 0 1 1 15 15.5 Z',
    ],
  },

  /* Rainha: cinco esferas em arco sobre coroa de pontas e corpo em degraus. */
  q: {
    body: [
      ball(6, 12, 2),
      ball(14, 8.5, 2),
      ball(22.5, 7.5, 2),
      ball(31, 9, 2),
      ball(39, 12, 2),
      'M9 26 C17.5 24.5 30 24.5 36 26 L38 14 L31 25 L31 11 L25.5 24.5 L22.5 9.5 L19.5 24.5 L14 10.5 L14 25 L7 14 Z',
      'M9 26 C9 28 10.5 28 11.5 30 C12.5 31.5 12.5 31 12 33.5 C10.5 34.5 10.5 36 10.5 36 C9 37.5 11 38.5 11 38.5 C17.5 39.5 27.5 39.5 34 38.5 C34 38.5 35.5 37.5 34 36 C34 36 34.5 34.5 33 33.5 C32.5 31 32.5 31.5 33.5 30 C34.5 28 36 28 36 26 C27.5 24.5 17.5 24.5 9 26 Z',
    ],
    shade: SHADE,
    detail: [
      'M11.5 30 C15 29 30 29 33.5 30',
      'M12 33.5 C18 32.5 27 32.5 33 33.5',
    ],
  },

  /* Rei: cruz sobre orbe e coroa de ombros largos. */
  k: {
    body: [
      'M22.5 25 C22.5 25 27 17.5 25.5 14.5 C25.5 14.5 24.5 12 22.5 12 C20.5 12 19.5 14.5 19.5 14.5 C18 17.5 22.5 25 22.5 25 Z',
      'M11.5 37 C17 40.5 27 40.5 32.5 37 L32.5 30 C32.5 30 41.5 25.5 38.5 19.5 C34.5 13 25 16 22.5 23.5 L22.5 27 L22.5 23.5 C19 16 9.5 13 6.5 19.5 C3.5 25.5 11.5 29.5 11.5 29.5 L11.5 37 Z',
    ],
    shade: SHADE,
    detail: [
      'M22.5 11.63 L22.5 6',
      'M20 8 L25 8',
      'M11.5 30 C17 27 27 27 32.5 30',
      'M11.5 33.5 C17 30.5 27 30.5 32.5 33.5',
      'M11.5 37 C17 34 27 34 32.5 37',
    ],
  },
};

export const PIECE_VIEW_BOX = '0 0 45 45';
export const PIECE_STROKE_WIDTH = 1.5;

/** Nomes em português, para os rótulos acessíveis das casas. */
export const PIECE_LABELS: Record<PieceKind, string> = {
  k: 'rei',
  q: 'rainha',
  r: 'torre',
  b: 'bispo',
  n: 'cavalo',
  p: 'peão',
};
