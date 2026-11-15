import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestApp, teardown } from './helpers/app.ts';
import { createUser, ensureSettings, findUserByEmail, findUserById, findUserByIdentifier, findUserByUsername, updateSettings, updateUserProfile } from '../src/repos/users.ts';
import type { TestContext } from './helpers/app.ts';

test('users repo: create + find', async () => {
  const ctx = await buildTestApp();
  try {
    const created = createUser(ctx.db, {
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hash',
      country: 'BR',
      bio: 'bio',
    });
    assert.ok(created.id);
    assert.equal(created.rating_blitz, 1200);

    assert.equal(findUserById(ctx.db, created.id)?.username, 'alice');
    assert.equal(findUserByUsername(ctx.db, 'ALICE')?.id, created.id);
    assert.equal(findUserByEmail(ctx.db, 'ALICE@example.com')?.id, created.id);
    assert.equal(findUserByIdentifier(ctx.db, 'alice')?.id, created.id);
    assert.equal(findUserByIdentifier(ctx.db, 'alice@example.com')?.id, created.id);
    assert.equal(findUserById(ctx.db, 'nao-existe'), null);
  } finally {
    await teardown(ctx);
  }
});

test('users repo: profile + settings', async () => {
  const ctx: TestContext = await buildTestApp();
  try {
    const user = createUser(ctx.db, { username: 'bob', email: 'bob@example.com', passwordHash: 'hash' });
    const updated = updateUserProfile(ctx.db, user.id, { bio: 'nova bio', location: 'Lisboa', country: 'PT' });
    assert.equal(updated?.bio, 'nova bio');
    assert.equal(updated?.location, 'Lisboa');
    assert.equal(updated?.country, 'PT');

    const settings = ensureSettings(ctx.db, user.id);
    assert.equal(settings.board_theme, 'walnut');
    const changed = updateSettings(ctx.db, user.id, {
      boardTheme: 'emerald',
      showCoordinates: false,
      soundVolume: 20,
    });
    assert.equal(changed.board_theme, 'emerald');
    assert.equal(changed.show_coordinates, 0);
    assert.equal(changed.sound_volume, 20);
  } finally {
    await teardown(ctx);
  }
});
