import { createElement } from 'react';
import type { ElementType, ReactNode } from 'react';

export interface CardProps {
  /** Elemento renderizado. Padrao `div`. */
  as?: ElementType;
  /** Titulo da cartao. */
  title?: ReactNode;
  /** Slot de icone ao lado do titulo. Decorativo. */
  icon?: ReactNode;
  /** Conteudo da cartao. */
  children?: ReactNode;
  className?: string;
}

/**
 * Cartao: uma superficie separada do fundo por passo de tom.
 * Sem borda de 1px e sem sombra em repouso.
 */
export function Card({ as = 'div', title, icon, children, className }: CardProps) {
  const head =
    title || icon ? (
      <header className="card-head">
        {icon ? (
          <span className="card-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {title ? <h3 className="card-title">{title}</h3> : null}
      </header>
    ) : null;

  return createElement(
    as,
    { className: className ? `card ${className}` : 'card' },
    head,
    children,
  );
}
