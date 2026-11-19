import type { RatingCategory } from '@castelo/shared';
import { BOT_PROFILES, type BotProfile } from '@castelo/engine';

export interface NavItem {
  label: string;
  to: string;
  icon: string;
  description: string;
}

/** Ícones SVG próprios (nunca emoji). O `d` do path é desenhado no componente. */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Jogar',
    to: '/play',
    icon: 'knight',
    description: 'Encontre um adversário ou enfrente o bot',
  },
  {
    label: 'Problemas',
    to: '/puzzles',
    icon: 'puzzle',
    description: 'Treine sua tática com desafios daily',
  },
  {
    label: 'Estudos',
    to: '/learn',
    icon: 'book',
    description: 'Aberturas explicadas lance a lance',
  },
  {
    label: 'Ranking',
    to: '/leaderboard',
    icon: 'trophy',
    description: 'Os melhores jogadores de cada categoria',
  },
  {
    label: 'Amigos',
    to: '/friends',
    icon: 'users',
    description: 'Convide pessoas e desafie-as',
  },
  {
    label: 'Partidas',
    to: '/games',
    icon: 'history',
    description: 'Revise e analise o seu histórico',
  },
];

export interface TimeControlOption {
  id: string;
  label: string;
  base: number;
  increment: number;
  category: RatingCategory;
}

export const TIME_CONTROLS: TimeControlOption[] = [
  { id: '1+0', label: '1 min', base: 60, increment: 0, category: 'bullet' },
  { id: '2+1', label: '2 min + 1s', base: 120, increment: 1, category: 'bullet' },
  { id: '3+0', label: '3 min', base: 180, increment: 0, category: 'blitz' },
  { id: '3+2', label: '3 min + 2s', base: 180, increment: 2, category: 'blitz' },
  { id: '5+0', label: '5 min', base: 300, increment: 0, category: 'blitz' },
  { id: '5+3', label: '5 min + 3s', base: 300, increment: 3, category: 'blitz' },
  { id: '10+0', label: '10 min', base: 600, increment: 0, category: 'rapid' },
  { id: '10+5', label: '10 min + 5s', base: 600, increment: 5, category: 'rapid' },
  { id: '15+10', label: '15 min + 10s', base: 900, increment: 10, category: 'rapid' },
  { id: '30+0', label: '30 min', base: 1800, increment: 0, category: 'classical' },
  { id: '60+0', label: '60 min', base: 3600, increment: 0, category: 'classical' },
];

export function findTimeControl(id: string): TimeControlOption | undefined {
  return TIME_CONTROLS.find((option) => option.id === id);
}

/**
 * Os níveis vêm do motor: uma única fonte de verdade para rótulo,
 * descrição e profundidade.
 */
export const BOT_DIFFICULTIES = (Object.entries(BOT_PROFILES) as [
  BotDifficultyId,
  BotProfile,
][]).map(([id, profile]) => ({
  id,
  label: profile.label,
  description: profile.description,
  depth: profile.depth,
})) as ReadonlyArray<{
  id: BotDifficultyId;
  label: string;
  description: string;
  depth: number;
}>;

export type BotDifficultyId = 'beginner' | 'casual' | 'strong' | 'master';

export const BOARD_THEMES = [
  { id: 'walnut', label: 'Nogueira', swatch: ['#EFE3CB', '#7A5B3C'] },
  { id: 'emerald', label: 'Esmeralda', swatch: ['#EBECD0', '#739552'] },
  { id: 'slate', label: 'Ardósia', swatch: ['#E4E7EA', '#7C8896'] },
  { id: 'ice', label: 'Gelo', swatch: ['#EAF2F6', '#9BB7C4'] },
] as const;

export type BoardThemeId = (typeof BOARD_THEMES)[number]['id'];
