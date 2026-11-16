import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workdir = mkdtempSync(join(tmpdir(), 'castelo-test-'));
process.env.DATABASE_PATH = join(workdir, 'test.db');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-dont-use-in-production';

const { openDatabase, setDb, getDb } = await import('../src/db/index.ts');
const { hashPassword, verifyPassword } = await import('../src/lib/password.ts');
const { createSession, setSessionCookie, csrfMatches, hashSessionToken } = await import('../src/lib/session.ts');
const { buildApp } = await import('../src/app.ts');

setDb(openDatabase(process.env.DATABASE_PATH));

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

function cookieOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((value) => String(value).split(';')[0]).join('; ');
}

async function register(app: Awaited<ReturnType<typeof buildApp>>, username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, email: `${username}@castelo.dev`, password: 'Castelo#2026!' },
  });
  const body = response.json() as { csrfToken: string; user: { id: string } };
  return { response, body, cookie: cookieOf(response) };
}

/* ------------------------------------------------------------------ *
 * Testes
 * ------------------------------------------------------------------ */

test('hash e verificação de senha', () => {
  const stored = hashPassword('Castelo#2026!');
  assert.ok(stored.startsWith('scrypt$'));
  assert.equal(verifyPassword('Castelo#2026!', stored), true);
  assert.equal(verifyPassword('outra-senha', stored), false);
  assert.equal(verifyPassword('', 'lixo'), false);
});

test('sessão: criar, validar e destruir', async () => {
  const app = await buildApp();
  const { body } = await register(app, 'sessao');

  const db = getDb();
  const session = createSession(db, { userId: body.user.id });
  assert.ok(session.token.length > 20);
  assert.ok(csrfMatches(session.csrfToken, session.csrfToken));
  assert.equal(csrfMatches('x', session.csrfToken), false);

  // o token cru nunca é gravado: só o sha256 dele
  const row = db
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .get(hashSessionToken(session.token)) as { id: string } | undefined;
  assert.ok(row, 'a sessão deve estar persistida pelo hash do token');
  const raw = db
    .prepare('SELECT id FROM sessions WHERE id = ?')
    .get(session.token) as { id: string } | undefined;
  assert.equal(raw, undefined, 'o token cru não pode estar no banco');

  await app.close();
});

test('registro cria usuário e devolve sessão + csrf', async () => {
  const app = await buildApp();
  const { response, body, cookie } = await register(app, 'ana');

  assert.equal(response.statusCode, 201);
  assert.equal(body.user.username, 'ana');
  assert.ok(body.csrfToken);
  assert.ok(cookie.includes('castelo_session'));

  await app.close();
});

test('usuário duplicado é rejeitado', async () => {
  const app = await buildApp();
  await register(app, 'dup');
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username: 'dup', email: 'dup2@castelo.dev', password: 'Castelo#2026!' },
  });
  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'conflict');

  await app.close();
});

test('senha fraca é rejeitada', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username: 'fraca', email: 'fraca@castelo.dev', password: '123' },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
});

test('login aceita usuário e e-mail', async () => {
  const app = await buildApp();
  await register(app, 'bruno');

  const byName = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { identifier: 'bruno', password: 'Castelo#2026!' },
  });
  assert.equal(byName.statusCode, 200);

  const byEmail = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { identifier: 'bruno@castelo.dev', password: 'Castelo#2026!' },
  });
  assert.equal(byEmail.statusCode, 200);

  await app.close();
});

test('login com senha errada devolve 401', async () => {
  const app = await buildApp();
  await register(app, 'carla');
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { identifier: 'carla', password: 'senha-errada' },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'credentials');

  await app.close();
});

test('rota protegida sem sessão devolve 401', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/api/friends' });
  assert.equal(response.statusCode, 401);

  await app.close();
});

test('mutação sem header CSRF devolve 403', async () => {
  const app = await buildApp();
  const { cookie } = await register(app, 'daniel');

  const withoutToken = await app.inject({
    method: 'POST',
    url: '/api/friends/request',
    headers: { cookie },
    payload: { username: 'outro' },
  });
  assert.equal(withoutToken.statusCode, 403);
  assert.equal(withoutToken.json().error.code, 'csrf');

  const withWrongToken = await app.inject({
    method: 'POST',
    url: '/api/friends/request',
    headers: { cookie, 'x-csrf-token': 'token-invalido' },
    payload: { username: 'outro' },
  });
  assert.equal(withWrongToken.statusCode, 403);

  await app.close();
});

test('rota inexistente devolve 404 canónico', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/api/nao-existe' });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'not_found');

  await app.close();
});

test('perfil público não expõe e-mail nem hash', async () => {
  const app = await buildApp();
  await register(app, 'elena');
  const response = await app.inject({ method: 'GET', url: '/api/users/elena' });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.username, 'elena');
  assert.equal(body.email, undefined);
  assert.equal(body.passwordHash, undefined);
  assert.ok(body.ratings);
  assert.ok(body.stats);

  await app.close();
});

test.after(() => {
  rmSync(workdir, { recursive: true, force: true });
});
