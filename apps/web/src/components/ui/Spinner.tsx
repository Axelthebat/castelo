import type { CSSProperties } from 'react';

export interface SpinnerProps {
  /** Diametro em pixels. */
  size?: number;
  className?: string;
  /** Texto lido por leitores de tela. */
  label?: string;
}

/**
 * Indicador de carregamento em SVG inline.
 * Nao usa emoji e nao depende de biblioteca de icones.
 *
 * Com `label` vazio o indicador vira puramente decorativo.
 */
export function Spinner({ size = 20, className, label = 'Carregando' }: SpinnerProps) {
  const style = { width: size, height: size } as CSSProperties;
  const decorative = label === '';

  return (
    <span
      className={className ? `inline-flex ${className}` : 'inline-flex'}
      role={decorative ? undefined : 'status'}
    >
      <svg
        style={style}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="castelo-spinner"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2.5"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {decorative ? null : <span className="sr-only">{label}</span>}
    </span>
  );
}
