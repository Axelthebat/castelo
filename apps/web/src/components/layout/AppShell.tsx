import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Icon, Wordmark } from '../icons.tsx';
import { Button } from '../ui/Button.tsx';
import { Avatar } from '../ui/Avatar.tsx';
import { useAuth } from '../../lib/auth.tsx';
import { useTheme } from '../../lib/theme.tsx';
import { NAV_ITEMS } from '../../lib/constants.ts';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'group flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] transition-colors',
              isActive
                ? 'bg-[var(--color-raised)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={
                  isActive
                    ? 'text-[var(--color-accent)]'
                    : 'text-[var(--color-ink-faint)] group-hover:text-[var(--color-accent)] transition-colors'
                }
              >
                <Icon name={item.icon as never} size={20} />
              </span>
              <span className="font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function AccountBlock() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <Button to="/register" variant="primary" fullWidth>
          Criar conta
        </Button>
        <Button to="/login" variant="secondary" fullWidth>
          Entrar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Link
        to={`/profile/${user.username}`}
        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-[var(--color-raised)]"
      >
        <Avatar seed={user.username} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.username}</span>
          <span className="block truncate text-xs text-[var(--color-ink-faint)]">
            {user.ratings.blitz} · Blitz
          </span>
        </span>
      </Link>
      <div className="flex gap-2">
        <div className="flex-1">
          <ThemeToggle />
        </div>
        <Button to="/settings" variant="ghost" size="sm" fullWidth aria-label="Configurações">
          <Icon name="gear" size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          onClick={() => void logout()}
          aria-label="Sair da conta"
        >
          <Icon name="logout" size={16} />
        </Button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh bg-[var(--color-ground)] text-[var(--color-ink)]">
      {/* Topo — mobile */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-[var(--color-surface)] px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]"
        >
          <Icon name="menu" size={22} />
        </button>
        <Link to="/" className="mr-auto" aria-label="Castelo — página inicial">
          <Wordmark />
        </Link>
        {user ? (
          <Link to={`/profile/${user.username}`} aria-label="Seu perfil">
            <Avatar seed={user.username} size={32} />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Button to="/login" variant="ghost" size="sm">
              Entrar
            </Button>
            <Button to="/register" variant="primary" size="sm">
              Criar conta
            </Button>
          </div>
        )}
      </header>

      {/* Gaveta — mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-[17rem] flex-col gap-6 bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between">
              <Wordmark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-ink-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <NavItems onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto pt-4">
              <AccountBlock />
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Lateral — desktop */}
        <aside className="sticky top-0 hidden h-dvh w-[13.5rem] shrink-0 flex-col gap-6 bg-[var(--color-surface)] p-4 lg:flex">
          <Link to="/" aria-label="Castelo — página inicial">
            <Wordmark />
          </Link>
          <NavItems />
          <div className="mt-auto flex flex-col gap-4 pt-4">
            <Link
              to="/games"
              className="flex items-center gap-2.5 px-2 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              <Icon name="search" size={18} />
              Buscar jogador
            </Link>
            <AccountBlock />
          </div>
        </aside>

        <main key={location.pathname} className="page-enter min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
