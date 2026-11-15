import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Rotulo visivel. */
  label?: ReactNode;
  /** Mensagem de erro. Tambem marca o campo como invalido. */
  error?: ReactNode;
  /** Texto de apoio abaixo do campo. */
  hint?: ReactNode;
}

/**
 * Campo de texto com rotulo, apoio e erro.
 *
 * O id e gerado quando nao vem pronto, e o campo sempre aponta para o
 * apoio e para o erro por `aria-describedby`.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex w-full flex-col">
      {label ? (
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        className={className ? `input ${className}` : 'input'}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
});
