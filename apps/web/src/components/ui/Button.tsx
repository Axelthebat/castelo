import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, MouseEvent, MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra o indicador de carregamento e bloqueia a acao. */
  loading?: boolean;
  /** Ocupa toda a largura do container. */
  fullWidth?: boolean;
  /** Quando presente, o botao vira um link do roteador. */
  to?: string;
  children?: ReactNode;
}

/**
 * Botao do sistema de design.
 *
 * Altura minima de 44px em todos os tamanhos, para respeitar o alvo de
 * toque. O accent so aparece na variante primaria.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    fullWidth = false,
    to,
    className,
    children,
    disabled = false,
    type = 'button',
    onClick,
    ...rest
  },
  ref,
) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth ? 'btn-block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (to !== undefined) {
    const blocked = disabled || loading;
    const linkClick = onClick as unknown as MouseEventHandler<HTMLAnchorElement> | undefined;
    return (
      <Link
        to={to}
        className={classes}
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        tabIndex={blocked ? -1 : undefined}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (blocked) event.preventDefault();
          linkClick?.(event);
        }}
      >
        {loading ? <Spinner size={16} label="" /> : null}
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      {...rest}
    >
      {loading ? <Spinner size={16} label="" /> : null}
      {children}
    </button>
  );
});
