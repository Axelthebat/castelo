import type { CSSProperties } from 'react';

export interface SkeletonProps {
  /** Largura fixa. Sem valor, o tamanho vem do className. */
  width?: number | string;
  /** Altura fixa. Sem valor, o tamanho vem do className. */
  height?: number | string;
  /** Raio do bloco. */
  radius?: number | string;
  className?: string;
}

/**
 * Bloco de carregamento.
 *
 * A varredura usa uma faixa solida, sem gradiente, e some quando o
 * sistema pede menos movimento. O tamanho vem do className, para o
 * esqueleto ocupar exatamente o espaco do conteudo real.
 */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  if (radius !== undefined) style.borderRadius = radius;

  return (
    <span
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={style}
      aria-hidden="true"
    />
  );
}
