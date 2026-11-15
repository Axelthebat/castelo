import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { loadEnv } from '../../src/env.ts';
import type { Env } from '../../src/env.ts';
import { closeDb, openDatabase, setDb } from '../../src/db/index.ts';
import { registerSecurity } from '../../src/plugins/security.ts';
import { registerRateLimit } from '../../src/plugins/rate-limit.ts';
import { registerApiRoutes } from '../../src/plugins/routes.ts';

export interface TestContext {
  app: FastifyInstance;
  db: DatabaseSync;
  dir: string;
  env: Env;
}

/** App Fastify isolado com banco temporário — nunca toca o banco de desenvolvimento. */
export async function buildTestApp(): Promise<TestContext> {
  const dir = mkdtempSync(path.join(tmpdir(), 'castelo-test-'));
  process.env.DATABASE_PATH = path.join(dir, 'test.db');
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-0123456789abcdef';
  process.env.APP_ORIGIN = 'http://localhost:5173';

  const env = loadEnv();
  const db = openDatabase(env.DATABASE_PATH);
  setDb(db);

  const app = Fastify({ logger: false });
  await registerSecurity(app);
  await registerRateLimit(app);
  await registerApiRoutes(app);
  await app.ready();

  return { app, db, dir, env };
}

export async function teardown(ctx: TestContext): Promise<void> {
  await ctx.app.close();
  closeDb();
  rmSync(ctx.dir, { recursive: true, force: true });
}

export function cookieHeader(name: string, value: string): string {
  return `${name}=${value}`;
}
