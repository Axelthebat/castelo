import { forwardRef, useId } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
}

/** Campo de texto longo, com o mesmo cuidado do `Input`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className, rows = 4, ...rest },
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
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={className ? `textarea ${className}` : 'textarea'}
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
