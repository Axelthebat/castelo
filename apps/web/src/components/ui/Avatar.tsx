import type { CSSProperties } from 'react';

/** Tamanhos de referencia. Qualquer outro numero tambem funciona. */
export type AvatarSize = 24 | 32 | 40 | 48 | 64 | 80 | (number & {});

export interface AvatarProps {
  /** Semente deterministica, em geral o nome de usuario. */
  seed: string;
  /** Texto alternativo. Por padrao, as iniciais da semente. */
  name?: string;
  size?: AvatarSize;
  className?: string;
}

/**
 * Matizes fora da familia violeta: a paleta e de terra, bronze e verde.
 * A mesma semente sempre devolve a mesma cor.
 */
const HUES = [8, 20, 38, 52, 96, 138, 176, 200] as const;

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function initialsFrom(seed: string): string {
  const parts = seed.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const single = parts[0];
    return single.slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Avatar deterministico: o nome vira matiz e iniciais.
 * Nao usa imagem externa nem emoji.
 */
export function Avatar({ seed, name, size = 40, className }: AvatarProps) {
  const hue = HUES[hashSeed(seed) % HUES.length];
  const initials = initialsFrom(name ?? seed);

  const style = {
    '--avatar-size': `${size}px`,
    '--avatar-hue': String(hue),
    fontSize: `${Math.round(size * 0.38)}px`,
  } as CSSProperties;

  return (
    <span
      className={className ? `avatar ${className}` : 'avatar'}
      style={style}
      title={name ?? seed}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
