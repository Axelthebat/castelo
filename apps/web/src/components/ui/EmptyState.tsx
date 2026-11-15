import type { ReactNode } from 'react';
import { Icon } from '../icons.tsx';
import type { IconName } from '../icons.tsx';

export interface EmptyStateProps {
  /** Ilustracao: um icone do app (pelo nome) ou qualquer elemento. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Acao sugerida, normalmente um botao. */
  action?: ReactNode;
  className?: string;
}

/**
 * Estado vazio: o que falta e o que fazer.
 * A voz e direta, sem desculpas.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const artwork =
    typeof icon === 'string' ? (
      <Icon name={icon as IconName} size={28} />
    ) : (
      icon ?? null
    );

  return (
    <div className={className ? `empty-state ${className}` : 'empty-state'} role="note">
      {artwork ? (
        <span className="empty-state-icon" aria-hidden="true">
          {artwork}
        </span>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-text">{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
