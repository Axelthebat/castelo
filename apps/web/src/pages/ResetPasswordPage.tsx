import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Wordmark } from '../components/icons.tsx';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});

    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await api.reset(token ?? '', password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFields(cause.fields ?? {});
      } else {
        setError('Não foi possível redefinir a senha.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[26rem] flex-col justify-center px-5 py-16">
      <div className="mb-8 flex justify-center">
        <Link to="/" aria-label="Castelo — página inicial">
          <Wordmark />
        </Link>
      </div>

      <div className="rounded-lg bg-[var(--color-surface)] p-6 sm:p-8">
        {done ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Senha alterada</h1>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Redirecionando para o login…
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Definir nova senha</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Escolha uma senha com pelo menos 10 caracteres.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-md bg-[var(--color-danger)]/12 px-3 py-2 text-sm text-[var(--color-danger)]"
              >
                {error}
              </p>
            )}

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <Input
                label="Nova senha"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fields.password}
                required
                autoFocus
              />
              <Input
                label="Confirmar senha"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
              <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
                Salvar nova senha
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
