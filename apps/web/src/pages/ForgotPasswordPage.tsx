import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Wordmark } from '../components/icons.tsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.forgot(email);
    } catch {
      /* a resposta é a mesma exista ou não o e-mail */
    } finally {
      setSubmitting(false);
      setSent(true);
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
        {sent ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Verifique seu e-mail</h1>
            <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
              Se existir uma conta para <strong className="text-[var(--color-ink)]">{email}</strong>,
              você receberá um link para redefinir a senha em instantes.
            </p>
            <Button to="/login" variant="secondary" fullWidth className="mt-6">
              Voltar para o login
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Informe o e-mail da sua conta e enviaremos as instruções.
            </p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <Input
                label="E-mail"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
              <Button type="submit" variant="primary" size="lg" loading={submitting} fullWidth>
                Enviar instruções
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-[var(--color-ink-muted)]">
              <Link to="/login" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
