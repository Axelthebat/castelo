import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { BOARD_THEMES, TIME_CONTROLS } from '../lib/constants.ts';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Select } from '../components/ui/Select.tsx';
import { Textarea } from '../components/ui/Textarea.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Icon } from '../components/icons.tsx';
import type { UserSettings } from '@castelo/shared';

type SettingsPatch = Partial<UserSettings>;

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3.5">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-[var(--color-ink-muted)]">{description}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-[var(--color-raised)] transition-colors peer-checked:bg-[var(--color-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)]" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--color-ink)] transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-[var(--color-surface)] p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => api.settings(signal),
  });

  const [draft, setDraft] = useState<SettingsPatch>({});
  const [profile, setProfile] = useState({ bio: '', location: '', country: '' });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (settingsQuery.data) setDraft(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: (patch: SettingsPatch) => api.updateSettings(patch),
    onSuccess: (data) => {
      setDraft(data);
      setSavedAt(Date.now());
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const saveProfile = useMutation({
    mutationFn: (payload: { bio?: string; location?: string; country?: string }) =>
      api.updateProfile(payload),
    onSuccess: () => {
      setSavedAt(Date.now());
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    saveProfile.mutate({
      bio: profile.bio || undefined,
      location: profile.location || undefined,
      country: profile.country || undefined,
    });
  }

  const current = { ...(settingsQuery.data ?? {}), ...draft } as UserSettings;

  if (!user) {
    return (
      <div className="mx-auto max-w-[62rem] px-5 py-14">
        <div className="rounded-lg bg-[var(--color-surface)] p-8 text-center">
          <h1 className="text-xl font-semibold">Entre para ajustar suas preferências</h1>
          <Button to="/login" variant="primary" className="mt-5">
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Configurações</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            Preferências de tabuleiro, som e conta. Salvas na sua conta.
          </p>
        </div>
        {savedAt && (
          <p className="flex items-center gap-1.5 text-sm text-[var(--color-success)]" role="status">
            <Icon name="check" size={16} />
            Alterações salvas
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Section title="Conta" description="Como você aparece para os outros jogadores.">
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <Input label="Nome de usuário" value={user.username} disabled readOnly />
            <Input label="E-mail" value={user.email} disabled readOnly />
            <Input
              label="Localidade"
              placeholder="Ex.: Recife, Brasil"
              value={profile.location}
              onChange={(event) => setProfile((p) => ({ ...p, location: event.target.value }))}
            />
            <Textarea
              label="Sobre"
              placeholder="Fale sobre o seu xadrez."
              rows={3}
              value={profile.bio}
              onChange={(event) => setProfile((p) => ({ ...p, bio: event.target.value }))}
            />
            <Button type="submit" variant="primary" loading={saveProfile.isPending}>
              Salvar perfil
            </Button>
          </form>
        </Section>

        <Section title="Tabuleiro" description="Cores, coordenadas e comportamento das peças.">
          {settingsQuery.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="flex flex-col gap-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Tema do tabuleiro</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BOARD_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => saveSettings.mutate({ boardTheme: theme.id })}
                      aria-pressed={current.boardTheme === theme.id}
                      className={`flex flex-col gap-2 rounded-md p-2 transition-colors ${
                        current.boardTheme === theme.id
                          ? 'bg-[var(--color-raised)]'
                          : 'hover:bg-[var(--color-raised)]'
                      }`}
                    >
                      <span className="flex h-12 overflow-hidden rounded">
                        <span className="flex-1" style={{ background: theme.swatch[0] }} />
                        <span className="flex-1" style={{ background: theme.swatch[1] }} />
                        <span className="flex-1" style={{ background: theme.swatch[0] }} />
                        <span className="flex-1" style={{ background: theme.swatch[1] }} />
                      </span>
                      <span className="text-xs">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Select
                label="Orientação padrão"
                value={current.boardOrientation}
                onChange={(event) =>
                  saveSettings.mutate({ boardOrientation: event.target.value as UserSettings['boardOrientation'] })
                }
                options={[
                  { value: 'auto', label: 'Automática' },
                  { value: 'white', label: 'Sempre de brancas' },
                  { value: 'black', label: 'Sempre de pretas' },
                ]}
              />

              <div className="divide-y divide-[var(--color-hairline)]">
                <Toggle
                  label="Coordenadas"
                  description="Mostrar arquivos e ranks dentro das casas."
                  checked={current.showCoordinates}
                  onChange={(value) => saveSettings.mutate({ showCoordinates: value })}
                />
                <Toggle
                  label="Movimentos legais"
                  description="Destacar as casas para onde a peça selecionada pode ir."
                  checked={current.showLegalMoves}
                  onChange={(value) => saveSettings.mutate({ showLegalMoves: value })}
                />
                <Toggle
                  label="Animar peças"
                  description="Deslizar a peça até o destino em vez de trocá-la de repente."
                  checked={current.animateMoves}
                  onChange={(value) => saveSettings.mutate({ animateMoves: value })}
                />
              </div>
            </div>
          )}
        </Section>

        <Section title="Som e relógio" description="O que você ouve e como a partida começa.">
          <div className="flex flex-col gap-5">
            <Toggle
              label="Efeitos sonoros"
              description="Som dos lances, xeque-mate e fim de jogo."
              checked={current.soundEnabled}
              onChange={(value) => saveSettings.mutate({ soundEnabled: value })}
            />

            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-sm font-medium">
                Volume
                <span className="tabular-nums text-[var(--color-ink-muted)]">{current.soundVolume}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={current.soundVolume}
                onChange={(event) =>
                  saveSettings.mutate({ soundVolume: Number(event.target.value) })
                }
                className="accent-[var(--color-accent)]"
              />
            </label>

            <Select
              label="Controle de tempo padrão"
              value={current.defaultTimeControl}
              onChange={(event) =>
                saveSettings.mutate({ defaultTimeControl: event.target.value })
              }
              options={TIME_CONTROLS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
            />
          </div>
        </Section>

        <Section title="Sessão" description="Encerre o acesso neste dispositivo.">
          <Button variant="secondary" onClick={() => void logout()}>
            <Icon name="logout" size={16} />
            Sair da conta
          </Button>
        </Section>
      </div>
    </div>
  );
}
