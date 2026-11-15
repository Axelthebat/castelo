import type { ReactNode } from 'react';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Texto da dica. */
  label: ReactNode;
  /** Elemento que recebe a dica. */
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

/**
 * Dica em CSS puro: aparece no hover e no foco por teclado.
 * A dica em si e decorativa para o leitor de tela, que ja le o rotulo
 * do controle que a ativa.
 */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={className ? `tooltip ${className}` : 'tooltip'} data-side={side}>
      <span className="tooltip-trigger">{children}</span>
      <span className="tooltip-bubble" role="presentation">
        {label}
      </span>
    </span>
  );
}
