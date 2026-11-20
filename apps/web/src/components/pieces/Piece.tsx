import { useId } from 'react';
import type { PieceColor, PieceKind } from '../board/fen.ts';
import { PIECE_GEOMETRY, PIECE_STROKE_WIDTH, PIECE_VIEW_BOX } from './pieces.ts';

export interface PieceProps {
  /** Tipo da peca: k, q, r, b, n ou p. */
  type: PieceKind;
  /** Cor da peca. */
  color: PieceColor;
  className?: string;
}

/**
 * A cor do tabuleiro e `w`/`b`, mas a classe de tema usa o nome por extenso.
 * A traducao fica aqui para que o CSS nunca dependa do formato do FEN.
 */
const COLOR_CLASS: Record<PieceColor, string> = {
  w: 'piece-white',
  b: 'piece-black',
};

/**
 * Uma peca do tabuleiro.
 *
 * As cores vem de custom properties (`.piece-white` / `.piece-black`),
 * por isso o SVG nao conhece a paleta. O preenchimento e a sombra sao
 * recortados pela propria silhueta, o que impede a sombra de vazar.
 */
export function Piece({ type, color, className }: PieceProps) {
  const geometry = PIECE_GEOMETRY[type];
  const rawId = useId();
  const clipId = `castelo-piece-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const classes = ['piece', COLOR_CLASS[color]];
  if (className) classes.push(className);

  return (
    <svg
      viewBox={PIECE_VIEW_BOX}
      className={classes.join(' ')}
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <clipPath id={clipId}>
          {geometry.body.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="45" height="45" fill="var(--piece-fill)" />
        <path d={geometry.shade} fill="var(--piece-shade)" />
      </g>
      <g
        fill="none"
        stroke="var(--piece-stroke)"
        strokeWidth={PIECE_STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {geometry.body.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
      {geometry.detail.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          stroke="var(--piece-stroke)"
          strokeWidth={PIECE_STROKE_WIDTH}
          strokeLinecap="round"
        />
      ))}
      {geometry.marks?.map((d, index) => (
        <path key={index} d={d} fill="var(--piece-stroke)" />
      ))}
    </svg>
  );
}
