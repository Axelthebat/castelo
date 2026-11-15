import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/password.ts';

test('password: hash/verify round-trip', () => {
  const password = 'Castelo#2026!';
  const stored = hashPassword(password);
  assert.ok(stored.startsWith('scrypt$32768$8$1$'), 'formato scrypt$N$r$p$salt$hash');
  const parts = stored.split('$');
  assert.equal(parts.length, 6);
  assert.equal(parts[1], '32768');
  assert.equal(parts[2], '8');
  assert.equal(parts[3], '1');
  assert.equal(verifyPassword(password, stored), true);
});

test('password: senha errada é rejeitada', () => {
  const stored = hashPassword('Castelo#2026!');
  assert.equal(verifyPassword('castelo#2026!', stored), false);
  assert.equal(verifyPassword('', stored), false);
});

test('password: hash malformado retorna false', () => {
  assert.equal(verifyPassword('qualquer', ''), false);
  assert.equal(verifyPassword('qualquer', 'nao-e-hash'), false);
  assert.equal(verifyPassword('qualquer', 'scrypt$32768$8$1$salt'), false);
  assert.equal(verifyPassword('qualquer', 'scrypt$abc$8$1$c2FsdA==$aGFzaA=='), false);
  assert.equal(verifyPassword('qualquer', 'scrypt$32768$8$1$c2FsdA==$aGFzaA=='), false);
});
