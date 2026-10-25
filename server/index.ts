import { registerProfile, readProfile } from './profile.ts';
import { registerDashboardCards, readDashboardCards, resetDashboardCards } from './dashboard-cards.ts';
import { rangeSessions } from './tracking/live.ts';
import { registerTimers } from './timers/routes.ts';
import { timerDetails, pausedTimers } from './timers/storage.ts';
import type { Request, Response, NextFunction } from 'express';
import { network } from './network/environment.ts';
import { listenNetwork, closeNetwork } from './network/listen.ts';
import { errorMessage } from '../src/shared/lib/errors.ts';
import { z } from 'zod';
import {
  backupSchema,
  backupCategorySchema,
  gameSchema,
  sessionSchema,
} from '../src/shared/api/contracts.ts';
import { readRow, readRows, transaction } from './storage.ts';
import { ensure, HttpFailure, requestRejection } from './http.ts';
import {
  steamAppId,
  newGame,
  validateGame,
  gamePatch,
  insertGameRecord,
  updateGameRecord,
} from './games.ts';
import { newCategory, categoryPatch } from './categories.ts';
import {
  timestamp,
  sessionPlan,
  newSession,
  sessionPatch,
  insertSession,
  sessionUpdateBindings,
} from './sessions.ts';
import { searchSteam, steamDirectories, readSteamManifest, ownedSteamGames } from './steam.ts';
import { exportBackup, validateBackup, restoreBackup } from './backup.ts';
import {
  sessionInputSchema,
  categoryInputSchema,
  gameInputSchema,
  settingsInputSchema,
} from './validation.ts';
import type { GameInput } from './validation.ts';
import express from 'express';
import { registerTracking } from './tracking/routes.ts';
import { registerMediaRoutes } from './media.ts';
import { withGameTimes } from './game-time.ts';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.TNG_DATA_DIR || path.join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'time-and-games.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(
  [
    'CREATE TABLE IF NOT EXISTS categories (',
    ' id TEXT PRIMARY KEY, group_name TEXT NOT NULL, name TEXT NOT NULL,',
    " color TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'circle',",
    ' is_work INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0',
    ');',
    'CREATE TABLE IF NOT EXISTS games (',
    ' id TEXT PRIMARY KEY, steam_appid INTEGER UNIQUE, name TEXT NOT NULL,',
    " poster TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'backlog',",
    " rating INTEGER, review TEXT NOT NULL DEFAULT '',",
    ' started_at TEXT, completed_at TEXT, playtime_minutes INTEGER NOT NULL DEFAULT 0,',
    ' created_at INTEGER NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS sessions (',
    ' id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id),',
    ' game_id TEXT REFERENCES games(id) ON DELETE SET NULL,',
    " title TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',",
    ' start_at INTEGER NOT NULL, end_at INTEGER, created_at INTEGER NOT NULL,',
    ' CHECK (end_at IS NULL OR end_at > start_at)',
    ');',
    'CREATE INDEX IF NOT EXISTS idx_sessions_range ON sessions(start_at, end_at);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category_id);',
  ].join('\n'),
);

if (
  !db
    .prepare('PRAGMA table_info(games)')
    .all()
    .some((column) => column.name === 'favorite')
)
  db.exec('ALTER TABLE games ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0');

const defaults: [string, string, string, string, string, number][] = [
  ['work-code', 'Работа', 'Кодинг', '#8e77ff', 'code', 1],
  ['work-study', 'Работа', 'Учёба', '#4fbcfa', 'book', 1],
  ['work-project', 'Работа', 'Проекты', '#be8cff', 'layers', 1],
  ['fun-games', 'Развлечения', 'Игры', '#f19c70', 'gamepad', 0],
  ['fun-movies', 'Развлечения', 'Фильмы и сериалы', '#f278a6', 'film', 0],
  ['fun-video', 'Развлечения', 'YouTube / Видео', '#ec6e8d', 'play', 0],
  ['life-cooking', 'Быт', 'Готовка', '#49c9a5', 'chef', 0],
  ['life-chores', 'Быт', 'Домашние дела', '#5ac6b6', 'home', 0],
  ['rest-walk', 'Отдых', 'Прогулка', '#a9d46c', 'footprints', 0],
  ['rest-other', 'Отдых', 'Другое', '#a2a8be', 'coffee', 0],
];
function seedCategories() {
  const ins = db.prepare(
    'INSERT INTO categories (id,group_name,name,color,icon,is_work,sort_order) VALUES (?,?,?,?,?,?,?)',
  );
  defaults.forEach((v, i) => ins.run(...v, i));
}
if (!db.prepare('SELECT COUNT(*) AS n FROM categories').get()?.n) seedCategories();

const api = express();
api.disable('x-powered-by');
api.use(express.json({ limit: '25mb' }));
api.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  const rejection = requestRejection(req);
  if (rejection) {
    error(res, rejection.status, rejection.message);
    return;
  }
  next();
});
const categoryStorageSchema = backupCategorySchema.transform((c) => ({
  ...c,
  is_work: Boolean(c.is_work),
}));
const selectCategories = () =>
  readRows(db, 'SELECT * FROM categories ORDER BY sort_order, rowid', categoryStorageSchema);
const selectGames = () =>
  withGameTimes(
    readRows(
      db,
      "SELECT * FROM games ORDER BY COALESCE(completed_at,started_at,'') DESC, created_at DESC",
      gameSchema,
    ),
    readRows(
      db,
      'SELECT game_id,start_at,end_at FROM sessions WHERE game_id IS NOT NULL',
      sessionSchema.pick({ game_id: true, start_at: true, end_at: true }),
    ),
  );
const selectActive = () =>
  readRows(db, 'SELECT * FROM sessions WHERE end_at IS NULL ORDER BY start_at DESC', sessionSchema).map(
    (session) => timerDetails(db, session),
  );
function error(res: Response, code: number, msg: string): void {
  res.status(code).json({ error: msg });
}
const textField = (v: unknown, max = 2000) =>
  (typeof v === 'string' || typeof v === 'number' ? String(v) : '').trim().slice(0, max);
function insertGame(input: GameInput) {
  const appid = steamAppId(input.steam_appid);
  const old = appid
    ? readRow(db, 'SELECT * FROM games WHERE steam_appid=?', gameSchema, [appid])
    : undefined;
  if (old) return { game: old, created: false };
  validateGame(input, true);
  const game = newGame(input, appid);
  insertGameRecord(db, game);
  return { game, created: true };
}
function importGames(games: GameInput[]) {
  let added = 0,
    skipped = 0;
  db.exec('BEGIN');
  try {
    for (const g of games) {
      if (!g.name) continue;
      if (insertGame(g).created) added++;
      else skipped++;
    }
    db.exec('COMMIT');
    return { added, skipped };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

registerDashboardCards(api, db);
registerProfile(api, db);
registerTimers(api, db);
const mediaStore = registerMediaRoutes(api, db);
const stopTracking = registerTracking(api, db);

api.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Time & Games', local: true }));
api.get('/api/bootstrap', (_req, res) =>
  res.json({
    dashboard_cards: readDashboardCards(db),
    profile: readProfile(db),
    categories: selectCategories(),
    games: selectGames(),
    active: selectActive(),
    paused: pausedTimers(db),
    media: mediaStore.list(),
  }),
);
api.get('/api/categories', (_req, res) => res.json(selectCategories()));
api.post('/api/categories', (req, res) => {
  const category = newCategory(db, categoryInputSchema.parse(req.body));
  db.prepare(
    'INSERT INTO categories VALUES (@id,@group_name,@name,@color,@icon,@is_work,@sort_order)',
  ).run({ ...category, is_work: Number(category.is_work) });
  res.status(201).json(category);
});
api.patch('/api/categories/:id', (req, res) => {
  const old = readRow(db, 'SELECT * FROM categories WHERE id=?', categoryStorageSchema, [req.params.id]);
  ensure(old, 'Категория не найдена', 404);
  const next = categoryPatch(old, categoryInputSchema.parse(req.body));
  db.prepare(
    'UPDATE categories SET group_name=@group_name,name=@name,color=@color,is_work=@is_work WHERE id=@id',
  ).run({
    id: next.id,
    group_name: next.group_name,
    name: next.name,
    color: next.color,
    is_work: Number(next.is_work),
  });
  res.json(next);
});
api.delete('/api/categories/:id', (req, res) => {
  if (db.prepare('SELECT 1 FROM sessions WHERE category_id=? LIMIT 1').get(req.params.id)) {
    error(res, 409, 'У категории уже есть записи. Сначала перенеси или удали их.');
    return;
  }
  const out = db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  if (!out.changes) {
    error(res, 404, 'Категория не найдена');
    return;
  }
  res.json({ ok: true });
});

api.get('/api/sessions', (req, res) => {
  const from = req.query.from === undefined ? 0 : timestamp(req.query.from);
  const to = req.query.to === undefined ? Date.now() + 86400000 : timestamp(req.query.to);
  if (from === null || to === null || from >= to) {
    error(res, 400, 'Неверный диапазон дат');
    return;
  }
  res.json(rangeSessions(db, from, to));
});
api.post('/api/sessions', (req, res) => {
  const plan = sessionPlan(db, sessionInputSchema.parse(req.body));
  const rows = plan.categoryIds.map((categoryId) => newSession(plan, categoryId));
  transaction(db, () => {
    rows.forEach((row) => {
      insertSession(db, row);
    });
  });
  res.status(201).json(rows);
});
api.patch('/api/sessions/:id', (req, res) => {
  const old = readRow(db, 'SELECT * FROM sessions WHERE id=?', sessionSchema, [req.params.id]);
  ensure(old, 'Запись не найдена', 404);
  const input = sessionInputSchema.parse(req.body);
  ensure(
    !(
      input.end_at === null &&
      old.end_at !== null &&
      db.prepare('SELECT 1 FROM timer_segments WHERE session_id=?').get(old.id)
    ),
    'Для продолжения занятия используй кнопку «Продолжить»',
    409,
  );
  const next = sessionPatch(db, old, input);
  db.prepare(
    'UPDATE sessions SET category_id=@category_id,game_id=@game_id,title=@title,note=@note,start_at=@start_at,end_at=@end_at WHERE id=@id',
  ).run(sessionUpdateBindings(next));
  res.json(next);
});
api.delete('/api/sessions/:id', (req, res) => {
  if (!db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id).changes) {
    error(res, 404, 'Запись не найдена');
    return;
  }
  res.json({ ok: true });
});

api.get('/api/games', (_req, res) => res.json(selectGames()));
api.post('/api/games', (req, res) => {
  try {
    const item = insertGame(gameInputSchema.parse(req.body));
    res.status(item.created ? 201 : 200).json(item);
  } catch (e) {
    error(res, 400, errorMessage(e));
  }
});
api.patch('/api/games/:id', (req, res) => {
  const old = readRow(db, 'SELECT * FROM games WHERE id=?', gameSchema, [req.params.id]);
  if (!old) {
    error(res, 404, 'Игра не найдена');
    return;
  }
  const input = gameInputSchema.parse(req.body);
  try {
    validateGame({ ...old, ...input }, false);
    const next = gamePatch(old, input);
    updateGameRecord(db, next);
    res.json(next);
  } catch (err) {
    error(res, 400, errorMessage(err));
  }
});
api.delete('/api/games/:id', (req, res) => {
  if (!db.prepare('DELETE FROM games WHERE id=?').run(req.params.id).changes) {
    error(res, 404, 'Игра не найдена');
    return;
  }
  res.json({ ok: true });
});

api.get('/api/steam/search', async (req, res) => {
  const query = textField(req.query.q, 100);
  if (query.length < 2) {
    res.json([]);
    return;
  }
  try {
    res.json(await searchSteam(query));
  } catch (err) {
    error(res, 502, 'Steam сейчас недоступен: ' + errorMessage(err));
  }
});
function scanInstalledSteamGames(customPath?: string) {
  if (process.platform !== 'win32') return [];
  const dirs = steamDirectories(customPath);
  const found = new Map<number, GameInput>();
  for (const dir of dirs)
    for (const file of readdirSync(dir)) {
      const game = readSteamManifest(dir, file);
      if (game?.steam_appid) found.set(game.steam_appid, game);
    }
  return [...found.values()];
}
api.post('/api/steam/import-installed', (req, res) => {
  try {
    const custom = textField(settingsInputSchema.parse(req.body).steam_path, 1000);
    if (custom && !path.isAbsolute(custom)) {
      error(res, 400, 'Укажи абсолютный путь к папке Steam');
      return;
    }
    const games = scanInstalledSteamGames(custom || undefined);
    res.json({ found: games.length, ...importGames(games) });
  } catch (e) {
    error(res, 500, 'Ошибка сканирования Steam: ' + errorMessage(e));
  }
});
api.post('/api/steam/import-owned', async (req, res) => {
  const input = settingsInputSchema.parse(req.body);
  const key = textField(input.api_key, 300),
    steamId = textField(input.steam_id, 30);
  if (!/^\d{17}$/.test(steamId) || !/^[0-9A-Fa-f]{32}$/.test(key)) {
    error(res, 400, 'Укажи SteamID64 (17 цифр) и Web API Key (32 символа)');
    return;
  }
  try {
    const list = await ownedSteamGames({ key, steamId });
    res.json({ found: list.length, ...importGames(list) });
  } catch (err) {
    error(res, 502, 'Не удалось получить библиотеку Steam: ' + errorMessage(err));
  }
});
function restoreDefaults(): void {
  seedCategories();
  resetDashboardCards(db);
}
api.post('/api/reset', (req, res) => {
  if (settingsInputSchema.parse(req.body).confirmation !== 'СБРОСИТЬ') {
    error(res, 400, 'Для сброса требуется подтверждение СБРОСИТЬ');
    return;
  }
  db.exec('BEGIN');
  try {
    db.exec(
      'DELETE FROM timer_segments; DELETE FROM timer_groups; DELETE FROM sessions; DELETE FROM games; DELETE FROM categories; DELETE FROM media; DELETE FROM tracking_inbox; DELETE FROM tracking_configuration; DELETE FROM tracking_bindings;',
    );
    restoreDefaults();
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
});
api.get('/api/export', (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="time-and-games-backup.json"');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(exportBackup(db, mediaStore), null, 2));
});
api.post('/api/import-backup', (req, res) => {
  const data = backupSchema.parse(req.body);
  if (data.categories.length > 500 || data.games.length > 20000 || data.sessions.length > 200000) {
    error(res, 413, 'Слишком большая резервная копия');
    return;
  }
  try {
    validateBackup(data);
    restoreBackup(db, mediaStore, data);
    res.json({
      ok: true,
      media: data.media.length,
      categories: data.categories.length,
      games: data.games.length,
      sessions: data.sessions.length,
    });
  } catch (err) {
    error(res, 400, 'Не удалось восстановить данные: ' + errorMessage(err));
  }
});
api.use('/api', (_req, res) => {
  error(res, 404, 'Неизвестный API маршрут');
});
api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpFailure) {
    error(res, err.status, err.message);
    return;
  }
  if (err instanceof z.ZodError) {
    error(res, 400, 'Неверный формат данных');
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    error(res, 400, 'Неверный JSON');
    return;
  }
  if (typeof err === 'object' && err !== null && 'status' in err && err.status === 413) {
    error(res, 413, 'Данные превышают допустимый размер');
    return;
  }
  console.error(err);
  error(res, 500, 'Внутренняя ошибка сервера');
});

const dist = path.join(ROOT, 'dist');
if (existsSync(dist)) {
  api.use(express.static(dist, { index: false }));
  api.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  api.get('/', (_req, res) =>
    res.type('text/plain').send('Time & Games: запусти npm run dev или npm run build'),
  );
}
const servers = listenNetwork(api, network);
function shutdown() {
  stopTracking();
  closeNetwork(servers, () => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
