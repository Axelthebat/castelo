/**
 * Temas do tabuleiro.
 *
 * As cores vivem em `src/styles/tokens.css` (contrato, secao 6). Aqui ficam
 * os nomes, os rotulos e a ponte entre os dois: o componente escreve as
 * custom properties do tema na raiz do tabuleiro, entao trocar de tema e
 * trocar o conteudo de quatro variaveis.
 */

import type { SquareTone } from './geometry.ts';
import { squareColorAt } from './geometry.ts';

export type BoardThemeId = 'walnut' | 'emerald' | 'slate' | 'ice';

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  /** Casa clara. */
  light: string;
  /** Casa escura. */
  dark: string;
  /** Cor da coordenada dentro de uma casa clara (oposta a casa). */
  coordOnLight: string;
  /** Cor da coordenada dentro de uma casa escura (oposta a casa). */
  coordOnDark: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  walnut: {
    id: 'walnut',
    label: 'Nogueira',
    light: '#efe3cb',
    dark: '#7a5b3c',
    coordOnLight: '#6e5130',
    coordOnDark: '#f0e6d2',
  },
  emerald: {
    id: 'emerald',
    label: 'Esmeralda',
    light: '#ebecd0',
    dark: '#739552',
    coordOnLight: '#3e5526',
    coordOnDark: '#f7f9f2',
  },
  slate: {
    id: 'slate',
    label: 'Ardosia',
    light: '#e4e7ea',
    dark: '#7c8896',
    coordOnLight: '#39424c',
    coordOnDark: '#f2f4f6',
  },
  ice: {
    id: 'ice',
    label: 'Gelo',
    light: '#eaf2f6',
    dark: '#9bb7c4',
    coordOnLight: '#3f5a69',
    coordOnDark: '#ffffff',
  },
};

export const BOARD_THEME_IDS = Object.keys(BOARD_THEMES) as BoardThemeId[];

export { squareColorAt };
export type { SquareTone };
