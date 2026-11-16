import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, teardown } from './helpers/app.ts';
import type { TestContext } from './helpers/app.ts';

const PASSWORD = 'Castelo#2026!';

function cookieOf(res: { cookies: Array<{ name: string; value: string }> }, name: string) {
  const cookie = res.cookies.find((c) => c.name === name);
  if (!cookie) throw new Error(`cookie ${name} ausente`);
  return cookie;
}

test('auth: register → me → login → wrong password → CSRF → logout', async () => {
  const ctx: TestContext = await buildTestApp();
  try {
    const { app } = ctx;

    // 1) registro
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'carlos', email: 'carlos@example.com', password: PASSWORD },
    });
    assert.equal(registerRes.statusCode, 201);
    const registerBody = registerRes.json();
    assert.equal(registerBody.user.username, 'carlos');
    // O token cru da sessão NÃO volta no corpo: ele vive só no cookie HttpOnly.
    assert.equal(registerBody.token, undefined);
    assert.ok(registerBody.csrfToken);
    const registerCookie = cookieOf(registerRes, 'castelo_session');
    assert.ok(registerCookie.value.length > 20);
    const registerCookieHeader = `castelo_session=${registerCookie.value}`;

    // 2) me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: registerCookieHeader },
    });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.json().user.username, 'carlos');
    assert.equal(meRes.json().csrfToken, registerBody.csrfToken);

    // 3) CSRF em rota de usuário sem header
    const patchNoCsrf = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: { cookie: registerCookieHeader },
      payload: { bio: 'nova bio' },
    });
    assert.equal(patchNoCsrf.statusCode, 403);
    assert.equal(patchNoCsrf.json().error.code, 'csrf');

    // 4) CSRF correto
    const patchOk = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: { cookie: registerCookieHeader, 'x-csrf-token': registerBody.csrfToken },
      payload: { bio: 'nova bio' },
    });
    assert.equal(patchOk.statusCode, 200);
    assert.equal(patchOk.json().bio, 'nova bio');

    // 5) login correto
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'carlos', password: PASSWORD },
    });
    assert.equal(loginRes.statusCode, 200);
    // Mesmo no login: o token cru fica no cookie, não no corpo da resposta.
    assert.equal(loginRes.json().token, undefined);
    assert.ok(loginRes.json().csrfToken);
    const loginCookie = cookieOf(loginRes, 'castelo_session');
    assert.ok(loginCookie.value.length > 20);
    const loginHeader = `castelo_session=${loginCookie.value}`;
    const loginCsrf = loginRes.json().csrfToken;

    // 6) login com senha errada
    const wrongRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'carlos', password: 'Errada#2026!' },
    });
    assert.equal(wrongRes.statusCode, 401);
    assert.equal(wrongRes.json().error.code, 'credentials');

    // 7) logout sem CSRF
    const logoutNoCsrf = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: loginHeader },
    });
    assert.equal(logoutNoCsrf.statusCode, 403);
    assert.equal(logoutNoCsrf.json().error.code, 'csrf');

    // 8) logout com CSRF errado
    const logoutBadCsrf = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: loginHeader, 'x-csrf-token': 'token-errado' },
    });
    assert.equal(logoutBadCsrf.statusCode, 403);
    assert.equal(logoutBadCsrf.json().error.code, 'csrf');

    // 9) logout com CSRF correto
    const logoutOk = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: loginHeader, 'x-csrf-token': loginCsrf },
    });
    assert.equal(logoutOk.statusCode, 204);

    // 10) sessão encerrada
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: loginHeader },
    });
    assert.equal(meAfter.statusCode, 401);
  } finally {
    await teardown(ctx);
  }
});

test('auth: register inválido retorna 400 validation', async () => {
  const ctx = await buildTestApp();
  try {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ab', email: 'invalido', password: 'curta' },
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.error.code, 'validation');
    assert.ok(body.error.fields);
    assert.ok(Object.keys(body.error.fields).length > 0);
  } finally {
    await teardown(ctx);
  }
});

test('auth: forgot sempre 200 (não revela e-mail)', async () => {
  const ctx = await buildTestApp();
  try {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/forgot',
      payload: { email: 'ninguem@example.com' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  } finally {
    await teardown(ctx);
  }
});
