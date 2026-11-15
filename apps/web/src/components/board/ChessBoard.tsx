import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Piece } from '../pieces/Piece.tsx';
import { PIECE_LABELS } from '../pieces/pieces.ts';
import { BOARD_THEMES } from './boardTheme.ts';
import type { BoardThemeId } from './boardTheme.ts';
import {
  findKing,
  isSquareAttacked,
  oppositeColor,
  parseFen,
} from './fen.ts';
import type { BoardLayout } from './fen.ts';
import { boardSquares, squareAt, squareColorAt, squarePosition } from './geometry.ts';
import type { BoardOrientation } from './geometry.ts';

export interface ChessBoardProps {
  /** Posicao em FEN. */
  fen: string;
  /** De quem e a vez de olhar o tabuleiro. */
  orientation?: BoardOrientation;
  /** Ultimo lance, para a lavagem de destaque. */
  lastMove?: { from: string; to: string } | null;
  /** Casa selecionada. */
  selected?: string | null;
  /** Casas para onde a peca selecionada pode ir. */
  legalTargets?: string[];
  onSquareClick?: (square: string) => void;
  onSquareDoubleClick?: (square: string) => void;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  animateMoves?: boolean;
  theme?: BoardThemeId;
  disabled?: boolean;
  ariaLabel?: string;
  /**
   * Casa do rei em xeque. Quando omitida, o tabuleiro deduz pelo FEN
   * (deteccao geometrica, que nao considera pecas presas).
   */
  checkSquare?: string | null;
}

function describeSquare(square: string, layout: BoardLayout): string {
  const piece = layout[square];
  if (!piece) return `casa ${square}, vazia`;
  const color = piece.color === 'w' ? 'branco' : 'preto';
  return `casa ${square}, ${PIECE_LABELS[piece.type]} ${color}`;
}

/**
 * Tabuleiro de xadrez controlado.
 *
 * Cada casa e um botao de verdade no DOM: a grade expoe 64 elementos
 * inspecionaveis, com rotulo, estado de selecao e navegacao por setas.
 */
export function ChessBoard({
  fen,
  orientation = 'w',
  lastMove = null,
  selected = null,
  legalTargets = [],
  onSquareClick,
  onSquareDoubleClick,
  showCoordinates = true,
  showLegalMoves = true,
  animateMoves = true,
  theme = 'walnut',
  disabled = false,
  ariaLabel = 'Tabuleiro de xadrez',
  checkSquare,
}: ChessBoardProps) {
  const { layout, turn } = useMemo(() => parseFen(fen), [fen]);
  const palette = BOARD_THEMES[theme];
  const squares = useMemo(() => boardSquares(orientation), [orientation]);
  const targets = useMemo(() => new Set(legalTargets), [legalTargets]);

  const [focusSquare, setFocusSquare] = useState<string | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  const [slide, setSlide] = useState<{ from: string; to: string } | null>(null);
  const firstRender = useRef(true);

  /**
   * A peca que acabou de se mover. O efeito roda antes da pintura, entao o
   * deslocamento comeca no mesmo quadro em que a peca aparece na casa nova.
   */
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!animateMoves || !lastMove) {
      setSlide(null);
      return;
    }
    const target = layout[lastMove.to];
    const origin = layout[lastMove.from];
    const samePiece =
      origin !== undefined && origin.type === target?.type && origin.color === target?.color;
    if (!target || samePiece) {
      setSlide(null);
      return;
    }
    setSlide({ from: lastMove.from, to: lastMove.to });
  }, [layout, lastMove, animateMoves]);

  const check = useMemo(() => {
    if (checkSquare !== undefined) return checkSquare;
    const king = findKing(layout, turn);
    if (!king) return null;
    return isSquareAttacked(layout, king, oppositeColor(turn)) ? king : null;
  }, [layout, turn, checkSquare]);

  const rootStyle = {
    '--cb-light': palette.light,
    '--cb-dark': palette.dark,
    '--cb-coord-on-light': palette.coordOnLight,
    '--cb-coord-on-dark': palette.coordOnDark,
  } as CSSProperties;

  const activeSquare = focusSquare ?? selected ?? squares[0];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const current = activeSquare;
    const { row, col } = squarePosition(current, orientation);
    let next: string | null = null;

    switch (event.key) {
      case 'ArrowUp':
        next = squareAt(row - 1, col, orientation);
        break;
      case 'ArrowDown':
        next = squareAt(row + 1, col, orientation);
        break;
      case 'ArrowLeft':
        next = squareAt(row, col - 1, orientation);
        break;
      case 'ArrowRight':
        next = squareAt(row, col + 1, orientation);
        break;
      case 'Home':
        next = squareAt(row, 0, orientation);
        break;
      case 'End':
        next = squareAt(row, 7, orientation);
        break;
      default:
        return;
    }

    if (!next) return;
    event.preventDefault();
    setFocusSquare(next);
    buttonRefs.current.get(next)?.focus();
  };

  return (
    <div className="cb-root" style={rootStyle}>
      <div
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={8}
        aria-colcount={8}
        aria-disabled={disabled || undefined}
        className={`cb-board${orientation === 'b' ? ' cb-board--flipped' : ''}`}
        onKeyDown={handleKeyDown}
      >
        {squares.map((square, index) => {
          const piece = layout[square];
          const tone = squareColorAt(square);
          const row = Math.floor(index / 8);
          const col = index % 8;
          const isSelected = selected === square;
          const isLast = lastMove !== null && (lastMove.from === square || lastMove.to === square);
          const isCheck = check === square;
          const isTarget = showLegalMoves && targets.has(square);
          const isMoving = slide !== null && slide.to === square;

          const states = [
            isSelected ? 'selected' : null,
            isLast ? 'last' : null,
            isCheck ? 'check' : null,
          ]
            .filter(Boolean)
            .join(' ');

          let slideStyle: CSSProperties | undefined;
          if (isMoving && slide) {
            const from = squarePosition(slide.from, orientation);
            const to = squarePosition(slide.to, orientation);
            slideStyle = {
              '--piece-dx': `${((to.col - from.col) / 8) * 100}%`,
              '--piece-dy': `${((to.row - from.row) / 8) * 100}%`,
            } as CSSProperties;
          }

          return (
            <button
              key={square}
              ref={(element) => {
                if (element) buttonRefs.current.set(square, element);
                else buttonRefs.current.delete(square);
              }}
              type="button"
              data-square={square}
              data-tone={tone}
              data-state={states || undefined}
              aria-label={describeSquare(square, layout)}
              aria-pressed={isSelected}
              disabled={disabled}
              tabIndex={square === activeSquare ? 0 : -1}
              className="cb-square"
              onFocus={() => setFocusSquare(square)}
              onClick={() => onSquareClick?.(square)}
              onDoubleClick={() => onSquareDoubleClick?.(square)}
            >
              {piece ? (
                <span
                  className={`cb-piece${isMoving ? ' cb-piece--moving' : ''}`}
                  style={slideStyle}
                >
                  <Piece type={piece.type} color={piece.color} />
                </span>
              ) : null}
              {isTarget ? (
                <span
                  className={`cb-marker ${
                    piece ? 'cb-marker--capture' : 'cb-marker--dot'
                  }`}
                />
              ) : null}
              {showCoordinates && col === 0 ? (
                <span className="cb-coord cb-rank" aria-hidden="true">
                  {square[1]}
                </span>
              ) : null}
              {showCoordinates && row === 7 ? (
                <span className="cb-coord cb-file" aria-hidden="true">
                  {square[0]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
