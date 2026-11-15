import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/icons.tsx';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[34rem] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-accent)]">
        <Icon name="knight" size={28} />
      </span>
      <h1 className="mt-6 text-[2.2rem] font-bold tracking-[-0.02em]">Peça fora do tabuleiro</h1>
      <p className="mt-3 text-[var(--color-ink-muted)]">
        A página que você procura não existe — ou foi movida. Volte para o tabuleiro e continue a
        partida.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/" variant="primary">
          Ir para o início
        </Button>
        <Button to="/play" variant="secondary">
          Abrir o tabuleiro
        </Button>
      </div>
    </div>
  );
}
