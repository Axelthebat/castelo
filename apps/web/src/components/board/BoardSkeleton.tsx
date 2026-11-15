import { useMemo } from 'react';
import { boardSquares, squareColorAt } from './geometry.ts';
import type { BoardOrientation } from './geometry.ts';
import { BOARD_THEMES } from './boardTheme.ts';
import type { BoardThemeId } from './boardTheme.ts';
import type { CSSProperties } from 'react';

export interface BoardSkeletonProps {
  orientation?: BoardOrientation;
  theme?: BoardThemeId;
  ariaLabel?: string;
}

/**
 * Esqueleto do tabuleiro: mesma geometria, mesma paleta, sem pecas.
 * Serve para o estado de carregamento sem mudar o tamanho da pagina.
 */
export function BoardSkeleton({
  orientation = 'w',
  theme = 'walnut',
  ariaLabel = 'Carregando tabuleiro',
}: BoardSkeletonProps) {
  const palette = BOARD_THEMES[theme];
  const squares = useMemo(() => boardSquares(orientation), [orientation]);

  const rootStyle = {
    '--cb-light': palette.light,
    '--cb-dark': palette.dark,
  } as CSSProperties;

  return (
    <div className="cb-root" style={rootStyle}>
      <div
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
        className={`cb-board${orientation === 'b' ? ' cb-board--flipped' : ''}`}
      >
        {squares.map((square) => (
          <div
            key={square}
            className="cb-skeleton-square"
            data-tone={squareColorAt(square)}
            data-square={square}
          />
        ))}
      </div>
    </div>
  );
}
