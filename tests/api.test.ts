import type { Backup, Game, Session } from '../src/shared/api/contracts.ts';
import type { GameInput } from '../src/shared/api/inputContracts.ts';
import type { Media, MediaInput } from '../src/shared/api/mediaContracts.ts';
import { mediaSchema } from '../src/shared/api/mediaContracts.ts';
import { z } from 'zod';
import type { ZodType } from 'zod';
import {
  bootstrapSchema,
  backupSchema,
  sessionSchema,
  timerSchema,
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
function awaitServerAddress(): Promise<string> {
  return new Promise((resolve, reject) => {
    attachStartupListeners(resolve, reject);
  });
}
function startupTimeout(reject: (error: Error) => void) {
  return setTimeout(() => {
    reject(new Error('API startup timeout'));
  }, 10000);
}
function attachStartupListeners(resolve: (url: string) => void, reject: (error: Error) => void): void {
  const timeout = startupTimeout(reject);
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
    reject(new Error('API exited ' + String(code) + ': ' + output));
  });
  child.once('error', reject);
}
async function launch() {
  child = spawn(process.execPath, ['server/index.ts'], {
    env: { ...process.env, TNG_PORT: '0', TNG_LAN_HOST: '', TNG_DATA_DIR: directory },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  base = await awaitServerAddress();
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

void test('direct screen URLs serve the app while unknown API paths stay JSON errors', async () => {
  for (const route of ['/settings', '/games', '/media', '/statistics?view=week']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await response.text(), /<div id="app"><\/div>/);
  }
  const response = await fetch(base + '/api/missing');
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
});

const invalidWrites = [
  ['/sessions', { category_ids: ['missing'] }],
  ['/sessions', { category_ids: ['work-code'], start_at: 10, end_at: 'invalid' }],
  ['/sessions', { category_ids: ['work-code'], start_at: 20, end_at: 10 }],
  ['/games', { name: 'Bad date', completed_at: '2026-02-30' }],
  ['/games', { name: 'Bad poster', poster: 'javascript:alert(1)' }],
] as const;
void test('local API rejects cross-origin writes and invalid input', async () => {
  assert.equal((await read(z.object({ ok: z.boolean() }), '/health')).data.ok, true);
  assert.equal((await call('/sessions', 'POST', {}, { Origin: 'https://example.com' })).status, 403);
  for (const [route, body] of invalidWrites) assert.equal((await call(route, 'POST', body)).status, 400);
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

async function createGame(input: GameInput): Promise<Game> {
  const result = await read(
    z.object({ game: gameSchema, created: z.boolean() }),
    '/games',
    'POST',
    input,
  );
  assert.equal(result.status, 201);
  return result.data.game;
}
async function linkedSession(game: Game): Promise<Session> {
  const result = await read(sessionSchema.array(), '/sessions', 'POST', {
    category_id: 'fun-games',
    game_id: game.id,
    start_at: 1000,
    end_at: 2000,
  });
  assert.equal(result.status, 201);
  return required(result.data[0]);
}
async function assertBrokenSessionRollback(backup: Backup) {
  const broken = structuredClone(backup);
  required(broken.sessions[0]).category_id = 'missing';
  assert.equal((await call('/import-backup', 'POST', broken)).status, 400);
  assert.deepEqual((await read(backupSchema, '/export')).data.sessions, backup.sessions);
}
async function assertGameDeletionAndRestore(game: Game, session: Session, backup: Backup) {
  await call('/games/' + game.id, 'DELETE');
  const rows = (await read(sessionSchema.array(), '/sessions?from=1&to=3000')).data;
  assert.equal(rows.find((item) => item.id === session.id)?.game_id, null);
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  assert.equal((await read(gameSchema.array(), '/games')).data[0]?.rating, 8.5);
  const duplicate = structuredClone(backup);
  duplicate.games.push({ ...required(duplicate.games[0]), id: 'duplicate-id' });
  assert.equal((await call('/import-backup', 'POST', duplicate)).status, 400);
  assert.equal((await read(gameSchema.array(), '/games')).data.length, 1);
}
void test('game editing, linked sessions, backup roundtrip and rollback preserve data', async () => {
  const game = await createGame({
    name: 'A game',
    steam_appid: 999999,
    status: 'completed',
    rating: 8.5,
    started_at: '2026-10-20',
    completed_at: '2026-10-22',
  });
  assert.equal(
    (await call('/games', 'POST', { name: 'Same Steam game', steam_appid: 999999 })).status,
    200,
  );
  assert.equal((await call('/games/' + game.id, 'PATCH', { started_at: '2026-10-23' })).status, 400);
  const session = await linkedSession(game),
    backup = (await read(backupSchema, '/export')).data;
  await assertBrokenSessionRollback(backup);
  await assertGameDeletionAndRestore(game, session, backup);
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

const movieInput: MediaInput = {
  name: 'A movie',
  kind: 'movie',
  status: 'completed',
  runtime_minutes: 120,
  rating: 8.5,
  imdb_id: 'tt1375666',
};
const seriesInput: MediaInput = {
  name: 'A series',
  kind: 'series',
  status: 'watching',
  runtime_minutes: 30,
  imdb_id: 'tt0903747',
  episodes: [
    { season: 1, number: 1, name: 'First', runtime_minutes: 35, released: '2020-01-01T00:00:00Z' },
    { season: 2, number: 1, name: 'Next', runtime_minutes: null, released: '2020-02-01T00:00:00Z' },
  ],
};
async function createMedia(input: MediaInput): Promise<Media> {
  return (await read(z.object({ item: mediaSchema, created: z.boolean() }), '/media', 'POST', input))
    .data.item;
}
async function assertSeriesAdvances(show: Media) {
  const one = (await read(mediaSchema, '/media/' + show.id + '/next-episode', 'POST', {})).data;
  assert.equal(one.current_episode, 1);
  assert.equal(one.watched_minutes, 35);
  const two = (await read(mediaSchema, '/media/' + show.id + '/next-episode', 'POST', {})).data;
  assert.equal(two.current_season, 2);
  assert.equal(two.status, 'completed');
  assert.equal(two.watched_minutes, 65);
  assert.equal((await call('/media/' + show.id + '/next-episode', 'POST', {})).status, 400);
}
async function assertMediaRatingEdit(movie: Media) {
  assert.equal((await call('/media/' + movie.id, 'PATCH', { rating: 8.2 })).status, 400);
  await read(mediaSchema, '/media/' + movie.id, 'PATCH', {
    rating: 9.5,
    time_mode: 'manual',
    watched_minutes: 200,
  });
  const duplicate = await read(z.object({ item: mediaSchema, created: z.boolean() }), '/media', 'POST', {
    name: 'Duplicate',
    imdb_id: 'tt1375666',
  });
  assert.equal(duplicate.data.created, false);
  assert.equal(duplicate.data.item.rating, 9.5);
}
async function assertMediaRestore(backup: Backup) {
  const broken = structuredClone(backup);
  required(broken.media[0]).poster = 'javascript:alert(1)';
  assert.equal((await call('/import-backup', 'POST', broken)).status, 400);
  assert.deepEqual((await read(backupSchema, '/export')).data.media, backup.media);
  const { media, ...legacy } = backup;
  assert.equal(media.length, 2);
  assert.equal((await call('/import-backup', 'POST', { ...legacy, version: 1 })).status, 200);
  assert.deepEqual((await read(mediaSchema.array(), '/media')).data, []);
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  assert.deepEqual((await read(backupSchema, '/export')).data.media, backup.media);
}
void test('media progress and half-star ratings persist without adding timeline sessions', async () => {
  const before = (await read(backupSchema, '/export')).data;
  const movie = await createMedia(movieInput);
  assert.equal(movie.watched_minutes, 120);
  await assertSeriesAdvances(await createMedia(seriesInput));
  await assertMediaRatingEdit(movie);
  const backup = (await read(backupSchema, '/export')).data;
  assert.deepEqual(backup.sessions, before.sessions);
  assert.equal(backup.media.length, 2);
  await shutdown();
  await launch();
  assert.equal((await read(mediaSchema.array(), '/media')).data.length, 2);
  await assertMediaRestore(backup);
  assert.equal((await call('/media/' + movie.id, 'DELETE')).status, 200);
  assert.equal((await call('/media/' + movie.id, 'DELETE')).status, 404);
});
async function assertFavoriteEdits(game: Game, movie: Media) {
  assert.equal(game.favorite, true);
  assert.equal(movie.completed_at, '2025-12-31');
  await call('/games/' + game.id, 'PATCH', { review: 'Preserve favorite' });
  assert.equal(
    (await read(gameSchema.array(), '/games')).data.find((item) => item.id === game.id)?.favorite,
    true,
  );
  await call('/media/' + movie.id, 'PATCH', { review: 'Preserve dates' });
  assert.equal(
    (await read(mediaSchema.array(), '/media')).data.find((item) => item.id === movie.id)?.favorite,
    true,
  );
  assert.equal((await call('/media/' + movie.id, 'PATCH', { started_at: '2026-01-01' })).status, 400);
}
async function assertFavoritesRestore(game: Game, movie: Media, backup: Backup) {
  await shutdown();
  await launch();
  assert.equal(
    (await read(gameSchema.array(), '/games')).data.find((item) => item.id === game.id)?.favorite,
    true,
  );
  await call('/media/' + movie.id, 'PATCH', { favorite: false });
  await call('/games/' + game.id, 'PATCH', { favorite: false });
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  const restored = (await read(backupSchema, '/export')).data;
  assert.equal(restored.games.find((item) => item.id === game.id)?.favorite, true);
  assert.equal(restored.media.find((item) => item.id === movie.id)?.favorite, true);
  assert.equal(restored.media.find((item) => item.id === movie.id)?.completed_at, '2025-12-31');
}
void test('favorites and media dates survive edits, restart and backup restoration', async () => {
  const game = await createGame({ name: 'Favorite game', favorite: true });
  const movie = await createMedia({
    name: 'Favorite movie',
    status: 'completed',
    favorite: true,
    completed_at: '2025-12-31',
    runtime_minutes: 90,
  });
  await assertFavoriteEdits(game, movie);
  await assertFavoritesRestore(game, movie, (await read(backupSchema, '/export')).data);
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
  assert.equal(bootstrap.media.length, 0);
  assert.equal(bootstrap.active.length, 0);
  assert.equal(bootstrap.categories.length, 10);
  assert.equal((await read(backupSchema, '/export')).data.sessions.length, 0);
  await shutdown();
  await launch();
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.categories.length, 10);
});

async function restoredPause() {
  const timer = (
    await read(sessionSchema.array(), '/sessions', 'POST', {
      category_id: 'work-study',
      title: 'Paused fixture',
      start_at: Date.now() - 5000,
    })
  ).data[0];
  assert.ok(timer);
  assert.equal((await call('/sessions/' + timer.id + '/pause', 'POST', {})).status, 200);
  const backup = (await read(backupSchema, '/export')).data;
  assert.equal(backup.version, 3);
  await shutdown();
  await launch();
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.paused[0]?.timer_id, timer.id);
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  return { timer, backup };
}
void test('paused timers survive API restart and backup, then resume without counting the gap', async () => {
  const { timer, backup } = await restoredPause();
  const paused = (await read(bootstrapSchema, '/bootstrap')).data.paused[0];
  assert.ok(paused);
  const next = (await read(timerSchema, '/timers/' + timer.id + '/resume', 'POST', {})).data;
  assert.equal(next.elapsed_before, (paused.end_at ?? 0) - paused.start_at);
  assert.equal(next.timer_id, timer.id);
  assert.equal((await call('/timers/' + timer.id + '/resume', 'POST', {})).status, 409);
  assert.equal((await call('/sessions/' + timer.id, 'PATCH', { end_at: null })).status, 409);
  await assertInvalidTimerBackup(backup);
  assert.equal((await call('/sessions/' + next.id + '/pause', 'POST', {})).status, 200);
  assert.equal((await call('/timers/' + timer.id + '/finish', 'POST', {})).status, 200);
  assert.equal((await read(bootstrapSchema, '/bootstrap')).data.paused.length, 0);
});

async function assertInvalidTimerBackup(backup: Backup) {
  const invalid = {
    ...backup,
    timer_groups: [{ id: 'invalid', paused: true, session_ids: ['missing'] }],
  };
  assert.equal((await call('/import-backup', 'POST', invalid)).status, 400);
}

async function contextBackup(): Promise<Backup> {
  const backup = (await read(backupSchema, '/export')).data;
  const session = required(backup.sessions[0]);
  session.tracking_context = { website: 'research.example', project: 'Thesis' };
  return backup;
}
void test('structured website and project metadata survives backup restoration and restart', async () => {
  const backup = await contextBackup(),
    context = backup.sessions[0]?.tracking_context;
  assert.equal((await call('/import-backup', 'POST', backup)).status, 200);
  await shutdown();
  await launch();
  const restored = (await read(backupSchema, '/export')).data;
  assert.deepEqual(restored.sessions[0]?.tracking_context, context);
  const sessions = (
    await read(sessionSchema.array(), '/sessions?from=1&to=' + String(Date.now() + 86400000))
  ).data;
  assert.deepEqual(
    sessions.find((item) => item.id === backup.sessions[0]?.id)?.tracking_context,
    context,
  );
});
