import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';
import { ApiError } from '../lib/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Wordmark } from '../components/icons.tsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/play';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password, remember);
      navigate(redirectTo, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível entrar. Tente novamente.',
      );
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
        <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Entre com seu nome de usuário ou e-mail.
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
            label="Usuário ou e-mail"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            autoFocus
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-hairline)] accent-[var(--color-accent)]"
              />
              Manter conectado
            </label>
            <Link
              to="/forgot"
              className="text-sm text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
            Entrar
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Ainda não tem conta?{' '}
        <Link
          to="/register"
          className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
