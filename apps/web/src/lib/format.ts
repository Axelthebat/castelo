import type { RatingCategory } from '@castelo/shared';

/* ------------------------------------------------------------------ *
 * Formatação
 * ------------------------------------------------------------------ */

export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Relógio com décimos — usado nos últimos 10 segundos. */
export function formatClockPrecise(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe >= 10_000) return formatClock(safe);
  const tenths = Math.floor((safe % 1000) / 100);
  const seconds = Math.floor(safe / 1000);
  return `${seconds}.${tenths}`;
}

export function formatRating(rating: number): string {
  return Math.round(rating).toLocaleString('pt-BR');
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace('.', ',')}%`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} d`;
  return formatDate(iso);
}

export const RATING_LABELS: Record<RatingCategory, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Clássico',
};

export const RATING_ORDER: RatingCategory[] = ['bullet', 'blitz', 'rapid', 'classical'];

export function ratingCategoryOf(timeControl: string): RatingCategory {
  const minutes = Number.parseInt(timeControl, 10);
  if (!Number.isFinite(minutes)) return 'blitz';
  if (minutes < 3) return 'bullet';
  if (minutes < 10) return 'blitz';
  if (minutes < 30) return 'rapid';
  return 'classical';
}

/* ------------------------------------------------------------------ *
 * Helpers de jogo
 * ------------------------------------------------------------------ */

export function resultLabel(result: string | null, perspective: 'w' | 'b'): string {
  if (!result) return 'Em andamento';
  if (result === '1/2-1/2') return 'Empate';
  const won = result === '1-0' ? 'w' : 'b';
  return won === perspective ? 'Vitória' : 'Derrota';
}

export function resultTone(result: string | null, perspective: 'w' | 'b'): 'win' | 'loss' | 'draw' {
  if (!result) return 'draw';
  if (result === '1/2-1/2') return 'draw';
  const won = result === '1-0' ? 'w' : 'b';
  return won === perspective ? 'win' : 'loss';
}

export function squareName(square: string): string {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  return `${files[file]}${rank}`;
}

export function initialsOf(username: string): string {
  const cleaned = username.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hash determinístico (FNV-1a de 32 bits) para avatares e cores. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
