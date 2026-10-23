import { z } from 'zod';
import type { ZodType } from 'zod';
import {
  bootstrapSchema,
  backupSchema,
  sessionSchema,
  gameSchema,
  backupCategorySchema,
} from '../src/shared/api/contracts.ts';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

let child: ReturnType<typeof spawn>, base: string, directory: string;
async function launch() {
  child = spawn(process.execPath, ['server/index.ts'], {
    env: { ...process.env, TNG_PORT: '0', TNG_DATA_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('API startup timeout'));
    }, 10000);
    let output = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`API exited ${String(code)}: ${output}`));
    });
    child.once('error', reject);
  });
}
async function shutdown() {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
}
async function call(
  route: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const res = await fetch(base + '/api' + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: (await res.json()) as unknown };
}
async function read<T>(schema: ZodType<T>, route: string, method = 'GET', body?: unknown) {
  const result = await call(route, method, body);
  return { ...result, data: schema.parse(result.data) };
}

function required<T>(value: T | undefined): T {
  assert.notEqual(value, undefined);
  if (value === undefined) throw new Error('Missing test fixture');
  return value;
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'time-and-games-test-'));
  await launch();
});
after(async () => {
  await shutdown();
  if (directory) await rm(directory, { recursive: true, force: true });
});

void test('local API rejects cross-origin writes and invalid input', async () => {
  assert.equal((await read(z.object({ ok: z.boolean() }), '/health')).data.ok, true);
  assert.equal((await call('/sessions', 'POST', {}, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await call('/sessions', 'POST', { category_ids: ['missing'] })).status, 400);
  assert.equal(
    (await call('/sessions', 'POST', { category_ids: ['work-code'], start_at: 10, end_at: 'invalid' }))
      .status,
    400,
  );
  assert.equal(
    (await call('/sessions', 'POST', { category_ids: ['work-code'], start_at: 20, end_at: 10 })).status,
    400,
  );
  assert.equal(
    (await call('/games', 'POST', { name: 'Bad date', completed_at: '2026-02-30' })).status,
    400,
  );
  assert.equal(
    (await call('/games', 'POST', { name: 'Bad poster', poster: 'javascript:alert(1)' })).status,
    400,
  );
});

void test('typed API rejects malformed JSON fields without changing stored data', async () => {
  const before = (await read(backupSchema, '/export')).data;
  for (const [route, body] of [
    ['/sessions', { category_ids: [1] }],
    ['/sessions', { category_id: 'work-code', title: { unexpected: true } }],
    ['/categories', { name: 'Invalid', group_name: 'Invalid', is_work: 'false' }],
    ['/games', { name: 'Invalid', playtime_minutes: 'many' }],
    ['/import-backup', { ...before, sessions: [{ start_at: 'invalid' }] }],
  ] as const)
    assert.equal((await call(route, 'POST', body)).status, 400);
  assert.deepEqual((await read(backupSchema, '/export')).data.sessions, before.sessions);
  assert.deepEqual((await read(bootstrapSchema, '/bootstrap')).data.active, []);
});

void test('parallel timers survive restart and cannot be duplicated by editing', async () => {
  const started = await read(sessionSchema.array(), '/sessions', 'POST', {
    category_ids: ['work-code', 'fun-video'],
    start_at: Date.now() - 100000,
    note: 'Parallel',
  });
  assert.equal(started.status, 201);
  assert.equal(started.data.length, 2);
  assert.equal((await call('/sessions', 'POST', { category_id: 'work-code' })).status, 409);
  const [a, b] = started.data;
  assert.ok(a);
  assert.ok(b);
  assert.equal((await call(`/sessions/${b.id}`, 'PATCH', { category_id: 'work-code' })).status, 409);
  await shutdown();
  await launch();
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.active.length, 2);
  assert.equal((await call(`/sessions/${a.id}`, 'PATCH', { end_at: Date.now() })).status, 200);
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.active.length, 1);
  await call(`/sessions/${b.id}`, 'PATCH', { end_at: Date.now() });
});

void test('game editing, linked sessions, backup roundtrip and rollback preserve data', async () => {
  const created = await read(z.object({ game: gameSchema, created: z.boolean() }), '/games', 'POST', {
    name: 'A game',
    steam_appid: 999999,
    status: 'completed',
    rating: 9,
    started_at: '2026-10-20',
    completed_at: '2026-10-22',
  });
  assert.equal(created.status, 201);
  const game = created.data.game;
  assert.equal(
    (await call('/games', 'POST', { name: 'Same Steam game', steam_appid: 999999 })).status,
    200,
  );
  assert.equal((await call(`/games/${game.id}`, 'PATCH', { started_at: '2026-10-23' })).status, 400);
  const session = await read(sessionSchema.array(), '/sessions', 'POST', {
    category_id: 'fun-games',
    game_id: game.id,
    start_at: 1000,
    end_at: 2000,
  });
  assert.equal(session.status, 201);
  const backup = (await read(backupSchema, '/export')).data;
  const broken = structuredClone(backup);
  required(broken.sessions[0]).category_id = 'missing';
  assert.equal((await call('/import-backup', 'POST', broken)).status, 400);
  assert.deepEqual((await read(backupSchema, '/export')).data.sessions, backup.sessions);
  await call(`/games/${game.id}`, 'DELETE');
  const rows = (await read(sessionSchema.array(), '/sessions?from=1&to=3000')).data;
  assert.equal(rows.find((s) => s.id === required(session.data[0]).id)?.game_id, null);
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  assert.equal((await read(gameSchema.array(), '/games')).data[0]?.rating, 9);
  const duplicate = structuredClone(backup);
  duplicate.games.push({ ...required(duplicate.games[0]), id: 'duplicate-id' });
  assert.equal((await call('/import-backup', 'POST', duplicate)).status, 400);
  assert.equal((await read(gameSchema.array(), '/games')).data.length, 1);
});

void test('categories with sessions cannot be deleted', async () => {
  assert.equal((await call('/categories/work-code', 'DELETE')).status, 409);
  const c = await read(backupCategorySchema, '/categories', 'POST', {
    group_name: 'Быт',
    name: 'Тестовая',
    color: '#abcdef',
    is_work: false,
  });
  assert.equal(c.status, 201);
  assert.equal((await call(`/categories/${c.data.id}`, 'PATCH', { name: 'Прогулка' })).status, 200);
  assert.equal((await call(`/categories/${c.data.id}`, 'DELETE')).status, 200);
});

void test('reset requires explicit confirmation, clears records and games, and restores default categories', async () => {
  const before = (await read(backupSchema, '/export')).data;
  assert.equal((await call('/reset', 'POST', {})).status, 400);
  assert.deepEqual((await read(backupSchema, '/export')).data.sessions, before.sessions);
  await call('/categories', 'POST', { name: 'Custom', group_name: 'Custom' });
  await call('/sessions', 'POST', { category_id: 'work-code' });
  assert.equal((await call('/reset', 'POST', { confirmation: 'СБРОСИТЬ' })).status, 200);
  const bootstrap = (await read(bootstrapSchema, '/bootstrap')).data;
  assert.equal(bootstrap.games.length, 0);
  assert.equal(bootstrap.active.length, 0);
  assert.equal(bootstrap.categories.length, 10);
  assert.equal((await read(backupSchema, '/export')).data.sessions.length, 0);
  await shutdown();
  await launch();
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.categories.length, 10);
});
