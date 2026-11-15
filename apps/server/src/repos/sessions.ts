import type { DatabaseSync } from 'node:sqlite';
import type { UserRow } from './users.ts';

/**
 * Sessões: o token bruto nunca é armazenado — apenas o hash (HMAC-SHA256).
 * Toda consulta é parameterizada.
 */

export interface SessionRow {
  id: string;
  user_id: string;
  csrf_token: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

export interface SessionWithUser {
  session: SessionRow;
  user: UserRow;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  csrfToken: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

export function insertSession(db: DatabaseSync, input: CreateSessionInput): SessionRow {
  db.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, user_agent, ip, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.csrfToken,
    input.userAgent,
    input.ip,
    input.createdAt,
    input.expiresAt,
    input.lastSeenAt,
  );
  return {
    id: input.id,
    user_id: input.userId,
    csrf_token: input.csrfToken,
    user_agent: input.userAgent,
    ip: input.ip,
    created_at: input.createdAt,
    expires_at: input.expiresAt,
    last_seen_at: input.lastSeenAt,
  };
}

export function findSessionWithUser(db: DatabaseSync, id: string): SessionWithUser | null {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!session) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as UserRow | undefined;
  if (!user) return null;
  return { session, user };
}

export function deleteSession(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteSessionsForUser(db: DatabaseSync, userId: string): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function updateSessionLastSeen(db: DatabaseSync, id: string, iso: string): void {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(iso, id);
}

export function updateSessionCsrf(db: DatabaseSync, id: string, csrfToken: string): void {
  db.prepare('UPDATE sessions SET csrf_token = ? WHERE id = ?').run(csrfToken, id);
}
