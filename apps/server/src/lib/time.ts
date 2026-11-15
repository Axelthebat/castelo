export function nowIso(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}

export function isoAfter(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
