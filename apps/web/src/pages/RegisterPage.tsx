import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.tsx';
import { ApiError } from '../lib/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Wordmark } from '../components/icons.tsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    setSubmitting(true);
    try {
      await register(username, email, password);
      navigate('/play', { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFields(cause.fields ?? {});
      } else {
        setError('Não foi possível criar a conta. Tente novamente.');
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
        <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Um nome de usuário, um e-mail e pronto para jogar.
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
            label="Nome de usuário"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            error={fields.username}
            hint="3 a 20 caracteres: letras, números e _"
            required
            autoFocus
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fields.email}
            required
          />
          <Input
            label="Senha"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fields.password}
            hint="Ao menos 10 caracteres, com maiúscula, minúscula e número"
            required
          />

          <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
            Criar conta
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
        Já tem conta?{' '}
        <Link
          to="/login"
          className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
