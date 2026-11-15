import test from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyRequest } from 'fastify';
import { buildTestApp, teardown } from './helpers/app.ts';
import { createUser } from '../src/repos/users.ts';
import {
  createSession,
  destroySession,
  getSession,
  getSessionUser,
  readSessionToken,
  rotateCsrf,
  sessionCookieName,
} from '../src/lib/session.ts';
import type { TestContext } from './helpers/app.ts';

function requestWithToken(token: string): FastifyRequest {
  return {
    cookies: { [sessionCookieName()]: token },
    headers: {},
  } as unknown as FastifyRequest;
}

test('session: create → validate → rotate → destroy', async () => {
  const ctx: TestContext = await buildTestApp();
  try {
    const user = createUser(ctx.db, {
      username: 'sessao',
      email: 'sessao@example.com',
      passwordHash: 'x',
    });

    const created = createSession(ctx.db, {
      userId: user.id,
      userAgent: 'node-test',
      ip: '127.0.0.1',
      remember: false,
    });
    assert.equal(created.token.length > 40, true);
    assert.notEqual(created.csrfToken, created.token);

    const req = requestWithToken(created.token);
    assert.equal(readSessionToken(req), created.token);

    const found = getSession(req, ctx.db);
    assert.ok(found);
    assert.equal(found.user.id, user.id);
    assert.equal(found.session.csrf_token, created.csrfToken);
    assert.equal(getSessionUser(req, ctx.db)?.id, user.id);

    const rotated = rotateCsrf(ctx.db, found.session.id);
    assert.notEqual(rotated, created.csrfToken);
    assert.equal(getSession(req, ctx.db)?.session.csrf_token, rotated);

    destroySession(req, ctx.db);
    assert.equal(getSessionUser(req, ctx.db), null);
  } finally {
    await teardown(ctx);
  }
});

test('session: token inválido/expirado não autentica', async () => {
  const ctx = await buildTestApp();
  try {
    const req = requestWithToken('token-inexistente');
    assert.equal(getSessionUser(req, ctx.db), null);

    const user = createUser(ctx.db, { username: 'exp', email: 'exp@example.com', passwordHash: 'x' });
    const created = createSession(ctx.db, { userId: user.id });
    ctx.db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', created.session.id);
    assert.equal(getSessionUser(requestWithToken(created.token), ctx.db), null);
  } finally {
    await teardown(ctx);
  }
});
