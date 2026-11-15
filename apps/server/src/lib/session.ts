import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { getEnv, isProduction } from '../env.ts';
import { getDb } from '../db/index.ts';
import { randomToken } from './ids.ts';
import { DAY_MS, HOUR_MS, isoAfter, nowIso } from './time.ts';
import {
  deleteSession,
  findSessionWithUser,
  insertSession,
  updateSessionCsrf,
  updateSessionLastSeen,
} from '../repos/sessions.ts';
import type { SessionRow, SessionWithUser } from '../repos/sessions.ts';
import type { UserRow } from '../repos/users.ts';

/**
 * Sessão: token aleatório de 32 bytes (base64url). O banco guarda apenas
 * HMAC-SHA256(token) com SESSION_SECRET como pepper — o token bruto nunca é
 * persistido. Cookie HttpOnly/SameSite=Lax; `__Host-` e Secure em produção.
 */

const REMEMBER_TTL_MS = 30 * DAY_MS;
const LAST_SEEN_INTERVAL_MS = 60 * 1000;

export function sessionCookieName(): string {
  return isProduction() ? '__Host-castelo_session' : 'castelo_session';
}

/** Hash do token (HMAC-SHA256) — É o que se grava em sessions.id. */
export function hashSessionToken(token: string): string {
  return createHmac('sha256', getEnv().SESSION_SECRET).update(token).digest('hex');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
  remember?: boolean;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  session: SessionRow;
}

export function createSession(db: DatabaseSync, options: CreateSessionOptions): CreatedSession {
  const token = randomToken(32);
  const id = hashSessionToken(token);
  const csrfToken = randomToken(32);
  const remember = options.remember ?? false;
  const ttlMs = remember ? REMEMBER_TTL_MS : getEnv().SESSION_TTL_HOURS * HOUR_MS;
  const created = nowIso();
  const expiresAt = isoAfter(ttlMs);
  const session = insertSession(db, {
    id,
    userId: options.userId,
    csrfToken,
    userAgent: options.userAgent ?? null,
    ip: options.ip ?? null,
    createdAt: created,
    expiresAt,
    lastSeenAt: created,
  });
  return { token, csrfToken, session };
}

/** Lê o cookie de sessão mesmo sem o plugin @fastify/cookie registrado. */
export function readSessionToken(req: FastifyRequest): string | null {
  const name = sessionCookieName();
  const jar = req.cookies;
  if (jar && typeof jar[name] === 'string' && jar[name]) return jar[name] as string;

  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function isExpired(session: SessionRow): boolean {
  return session.expires_at <= new Date().toISOString();
}

export function getSession(req: FastifyRequest, db: DatabaseSync = getDb()): SessionWithUser | null {
  const token = readSessionToken(req);
  if (!token) return null;
  const found = findSessionWithUser(db, hashSessionToken(token));
  if (!found) return null;
  if (isExpired(found.session)) {
    deleteSession(db, found.session.id);
    return null;
  }
  // atualiza last_seen_at com baixa frequência para não escrever a cada request
  if (Date.now() - new Date(found.session.last_seen_at).getTime() > LAST_SEEN_INTERVAL_MS) {
    updateSessionLastSeen(db, found.session.id, nowIso());
    found.session.last_seen_at = nowIso();
  }
  return found;
}

export function getSessionUser(req: FastifyRequest, db: DatabaseSync = getDb()): UserRow | null {
  return getSession(req, db)?.user ?? null;
}

export function destroySession(req: FastifyRequest, db: DatabaseSync = getDb()): void {
  const token = readSessionToken(req);
  if (token) deleteSession(db, hashSessionToken(token));
}

export function rotateCsrf(db: DatabaseSync, sessionId: string): string {
  const csrfToken = randomToken(32);
  updateSessionCsrf(db, sessionId, csrfToken);
  return csrfToken;
}

export interface SessionCookieOptions {
  path: '/';
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge?: number;
}

export function sessionCookieOptions(remember: boolean): SessionCookieOptions {
  const options: SessionCookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
  };
  if (remember) options.maxAge = Math.floor(REMEMBER_TTL_MS / 1000);
  return options;
}

export function setSessionCookie(reply: FastifyReply, token: string, remember: boolean): void {
  reply.setCookie(sessionCookieName(), token, sessionCookieOptions(remember));
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(sessionCookieName(), { path: '/' });
}

/** Comparação constante entre header e token da sessão. */
export function csrfMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
