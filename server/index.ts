import type { Request, Response, NextFunction } from 'express';
import type { SQLInputValue } from 'node:sqlite';
import type { AddressInfo } from 'node:net';
import type { Category, Game, Session } from '../src/shared/api/contracts.ts';
import { errorMessage } from '../src/shared/lib/errors.ts';
type DbCategory = Omit<Category, 'is_work'> & { is_work: number };
import { z } from 'zod';
import { backupSchema } from '../src/shared/api/contracts.ts';
import {
  sessionInputSchema,
  categoryInputSchema,
  gameInputSchema,
  settingsInputSchema,
  steamSearchSchema,
  steamOwnedSchema,
} from './validation.ts';
import type { GameInput } from './validation.ts';
import express from 'express';
import { withGameTimes } from './game-time.ts';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
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
  const host = req.headers.host?.split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host || '')) {
    error(res, 403, 'Только локальный доступ');
    return;
  }
  const origin = req.headers.origin;
  if (
    origin &&
    ![
      'http://127.0.0.1:3535',
      'http://localhost:3535',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      `http://127.0.0.1:${process.env.TNG_PORT ?? ''}`,
    ].includes(origin)
  ) {
    error(res, 403, 'Запрос с другого сайта запрещён');
    return;
  }
  if (
    ['POST', 'PATCH', 'DELETE'].includes(req.method) &&
    req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json'
  ) {
    error(res, 415, 'Используй Content-Type: application/json');
    return;
  }
  next();
});
const selectCategories = () =>
  db
    .prepare('SELECT * FROM categories ORDER BY sort_order, rowid')
    .all()
    .map((c) => ({ ...c, is_work: !!c.is_work }));
const selectGames = () =>
  withGameTimes(
    db
      .prepare("SELECT * FROM games ORDER BY COALESCE(completed_at,started_at,'') DESC, created_at DESC")
      .all() as unknown as Game[],
    db
      .prepare('SELECT game_id,start_at,end_at FROM sessions WHERE game_id IS NOT NULL')
      .all() as unknown as Pick<Session, 'game_id' | 'start_at' | 'end_at'>[],
  );
const selectActive = () =>
  db.prepare('SELECT * FROM sessions WHERE end_at IS NULL ORDER BY start_at DESC').all();
function error(res: Response, code: number, msg: string): void {
  res.status(code).json({ error: msg });
}
const textField = (v: unknown, max = 2000) =>
  (typeof v === 'string' || typeof v === 'number' ? String(v) : '').trim().slice(0, max);
const timestamp = (v: unknown) =>
  (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) &&
  Number.isSafeInteger(Number(v)) &&
  Number(v) > 0
    ? Number(v)
    : null;
const validDate = (v: unknown) =>
  v === null ||
  v === '' ||
  (typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v);
const statuses = new Set(['backlog', 'playing', 'completed', 'paused', 'dropped']);
const gameFields = new Set<
  'name' | 'poster' | 'status' | 'rating' | 'review' | 'started_at' | 'completed_at' | 'playtime_minutes'
>(['name', 'poster', 'status', 'rating', 'review', 'started_at', 'completed_at', 'playtime_minutes']);
function validateGame(g: GameInput, isNew: boolean) {
  if ((isNew || 'name' in g) && !textField(g.name, 160)) throw new Error('Укажи название игры');
  if (g.poster && !externalUrl(g.poster)) throw new Error('Постер должен быть HTTPS-ссылкой');
  if (g.started_at && g.completed_at && g.completed_at < g.started_at)
    throw new Error('Дата прохождения должна быть не раньше начала');
  if ('status' in g && !statuses.has(g.status ?? '')) throw new Error('Неизвестный статус игры');
  if (
    'rating' in g &&
    g.rating !== null &&
    (!Number.isInteger(Number(g.rating)) || Number(g.rating) < 1 || Number(g.rating) > 10)
  )
    throw new Error('Оценка должна быть от 1 до 10');
  for (const f of ['started_at', 'completed_at'])
    if (f in g && !validDate(g[f as keyof GameInput])) throw new Error('Неверная дата');
  if (
    'playtime_minutes' in g &&
    (!Number.isInteger(Number(g.playtime_minutes)) || Number(g.playtime_minutes) < 0)
  )
    throw new Error('Неверное время в игре');
}
const steamPoster = (appid: number) =>
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
function insertGame(g: GameInput) {
  const appid =
    Number.isSafeInteger(Number(g.steam_appid)) && Number(g.steam_appid) > 0
      ? Number(g.steam_appid)
      : null;
  if (appid) {
    const old = db.prepare('SELECT * FROM games WHERE steam_appid=?').get(appid) as unknown as
      Game | undefined;
    if (old) return { game: old, created: false };
  }
  validateGame(g, true);
  const x = {
    id: randomUUID(),
    steam_appid: appid,
    name: textField(g.name, 160),
    poster: textField(g.poster, 800) || (appid ? steamPoster(appid) : ''),
    status: g.status || 'backlog',
    rating: g.rating ?? null,
    review: textField(g.review, 10000),
    started_at: g.started_at || null,
    completed_at: g.completed_at || null,
    playtime_minutes: Number(g.playtime_minutes) || 0,
    created_at: Date.now(),
  };
  db.prepare(
    'INSERT INTO games (id,steam_appid,name,poster,status,rating,review,started_at,completed_at,playtime_minutes,created_at) VALUES (@id,@steam_appid,@name,@poster,@status,@rating,@review,@started_at,@completed_at,@playtime_minutes,@created_at)',
  ).run(x);
  return { game: x, created: true };
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

api.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Time & Games', local: true }));
api.get('/api/bootstrap', (_req, res) =>
  res.json({ categories: selectCategories(), games: selectGames(), active: selectActive() }),
);
api.get('/api/categories', (_req, res) => res.json(selectCategories()));
api.post('/api/categories', (req, res) => {
  const b = categoryInputSchema.parse(req.body),
    name = textField(b.name, 55),
    group_name = textField(b.group_name, 40);
  if (!name || !group_name) {
    error(res, 400, 'Нужны название и группа категории');
    return;
  }
  const color = b.color && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#8e77ff';
  const id = randomUUID(),
    order = db.prepare('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM categories').get()?.n ?? 0;
  db.prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?)').run(
    id,
    group_name,
    name,
    color,
    textField(b.icon, 30) || 'circle',
    b.is_work ? 1 : 0,
    order,
  );
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(id));
});
api.patch('/api/categories/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id) as unknown as
    DbCategory | undefined;
  if (!old) {
    error(res, 404, 'Категория не найдена');
    return;
  }
  const b = categoryInputSchema.parse(req.body);
  const next = {
    ...old,
    group_name: 'group_name' in b ? textField(b.group_name, 40) : old.group_name,
    name: 'name' in b ? textField(b.name, 55) : old.name,
    color: b.color && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : old.color,
    is_work: 'is_work' in b ? (b.is_work ? 1 : 0) : old.is_work,
  };
  if (!next.name || !next.group_name) {
    error(res, 400, 'Категория не может быть пустой');
    return;
  }
  db.prepare(
    'UPDATE categories SET group_name=@group_name,name=@name,color=@color,is_work=@is_work WHERE id=@id',
  ).run({
    id: next.id,
    group_name: next.group_name,
    name: next.name,
    color: next.color,
    is_work: next.is_work,
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
  res.json(
    db
      .prepare(
        'SELECT * FROM sessions WHERE start_at < ? AND (end_at IS NULL OR end_at > ?) ORDER BY start_at DESC',
      )
      .all(to, from),
  );
});
api.post('/api/sessions', (req, res) => {
  const b = sessionInputSchema.parse(req.body);
  const ids = Array.from(
    new Set(Array.isArray(b.category_ids) ? b.category_ids : [b.category_id]),
  ).filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (!ids.length || ids.length > 15) {
    error(res, 400, 'Выбери от 1 до 15 категорий');
    return;
  }
  const start = b.start_at === undefined ? Date.now() : timestamp(b.start_at);
  const end = b.end_at === undefined || b.end_at === null ? null : timestamp(b.end_at);
  if (start === null || (b.end_at != null && (end === null || end <= start))) {
    error(res, 400, 'Время окончания должно быть позже начала');
    return;
  }
  if (end === null && start > Date.now()) {
    error(res, 400, 'Таймер не может начинаться в будущем');
    return;
  }
  if (b.game_id && !db.prepare('SELECT 1 FROM games WHERE id=?').get(b.game_id)) {
    error(res, 400, 'Игра не найдена');
    return;
  }
  for (const cat of ids) {
    if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(cat)) {
      error(res, 400, 'Категория не найдена');
      return;
    }
    if (
      end === null &&
      db.prepare('SELECT 1 FROM sessions WHERE category_id=? AND end_at IS NULL').get(cat)
    ) {
      error(res, 409, 'Таймер этой категории уже запущен');
      return;
    }
  }
  const now = Date.now(),
    made: Session[] = [],
    statement = db.prepare(
      'INSERT INTO sessions (id,category_id,game_id,title,note,start_at,end_at,created_at) VALUES (?,?,?,?,?,?,?,?)',
    );
  db.exec('BEGIN');
  try {
    for (const cat of ids) {
      const row = {
        id: randomUUID(),
        category_id: cat,
        game_id: b.game_id || null,
        title: textField(b.title, 160),
        note: textField(b.note, 10000),
        start_at: start,
        end_at: end,
        created_at: now,
      };
      statement.run(
        row.id,
        row.category_id,
        row.game_id,
        row.title,
        row.note,
        row.start_at,
        row.end_at,
        row.created_at,
      );
      made.push(row);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.status(201).json(made);
});
api.patch('/api/sessions/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM sessions WHERE id=?').get(req.params.id) as unknown as
    Session | undefined;
  if (!old) {
    error(res, 404, 'Запись не найдена');
    return;
  }
  const b = sessionInputSchema.parse(req.body);
  const next = { ...old, start_at: old.start_at as number | null };
  if (b.category_id !== undefined) next.category_id = b.category_id;
  if ('game_id' in b) next.game_id = b.game_id || null;
  if ('title' in b) next.title = textField(b.title, 160);
  if ('note' in b) next.note = textField(b.note, 10000);
  if ('start_at' in b) next.start_at = timestamp(b.start_at);
  if ('end_at' in b) next.end_at = b.end_at === null ? null : timestamp(b.end_at);
  if (!next.start_at || (next.end_at !== null && (!next.end_at || next.end_at <= next.start_at))) {
    error(res, 400, 'Неверные границы времени');
    return;
  }
  if (next.end_at === null && next.start_at > Date.now()) {
    error(res, 400, 'Таймер не может начинаться в будущем');
    return;
  }
  if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(next.category_id)) {
    error(res, 400, 'Категория не найдена');
    return;
  }
  if (next.game_id && !db.prepare('SELECT 1 FROM games WHERE id=?').get(next.game_id)) {
    error(res, 400, 'Игра не найдена');
    return;
  }
  if (
    next.end_at === null &&
    db
      .prepare('SELECT 1 FROM sessions WHERE category_id=? AND end_at IS NULL AND id<>?')
      .get(next.category_id, next.id)
  ) {
    error(res, 409, 'Таймер этой категории уже запущен');
    return;
  }
  db.prepare(
    'UPDATE sessions SET category_id=@category_id, game_id=@game_id,title=@title,note=@note,start_at=@start_at,end_at=@end_at WHERE id=@id',
  ).run({
    id: next.id,
    category_id: next.category_id,
    game_id: next.game_id,
    title: next.title,
    note: next.note,
    start_at: next.start_at,
    end_at: next.end_at,
  });
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
  const old = db.prepare('SELECT * FROM games WHERE id=?').get(req.params.id) as unknown as
    Game | undefined;
  if (!old) {
    error(res, 404, 'Игра не найдена');
    return;
  }
  const b = gameInputSchema.parse(req.body);
  try {
    validateGame({ ...old, ...b }, false);
  } catch (e) {
    error(res, 400, errorMessage(e));
    return;
  }
  const next = { ...old };
  for (const f of gameFields)
    if (b[f] !== undefined) {
      if (f === 'rating') next[f] = b.rating ?? null;
      else if (f === 'playtime_minutes') next[f] = Number(b.playtime_minutes);
      else if (f === 'status') next.status = b.status ?? old.status;
      else if (f === 'started_at' || f === 'completed_at') next[f] = b[f] || null;
      else next[f] = textField(b[f], f === 'review' ? 10000 : f === 'poster' ? 800 : 160);
    }
  if (!next.name) {
    error(res, 400, 'Название не может быть пустым');
    return;
  }
  db.prepare(
    'UPDATE games SET name=@name, poster=@poster,status=@status,rating=@rating,review=@review,started_at=@started_at,completed_at=@completed_at,playtime_minutes=@playtime_minutes WHERE id=@id',
  ).run({ id: next.id, ...Object.fromEntries([...gameFields].map((key) => [key, next[key]])) });
  res.json(next);
});
api.delete('/api/games/:id', (req, res) => {
  if (!db.prepare('DELETE FROM games WHERE id=?').run(req.params.id).changes) {
    error(res, 404, 'Игра не найдена');
    return;
  }
  res.json({ ok: true });
});

function externalUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

api.get('/api/steam/search', async (req, res) => {
  const q = textField(req.query.q, 100);
  if (q.length < 2) {
    res.json([]);
    return;
  }
  try {
    const u = new URL('https://store.steampowered.com/api/storesearch/');
    u.searchParams.set('term', q);
    u.searchParams.set('l', 'russian');
    u.searchParams.set('cc', 'US');
    const response = await fetch(u, {
      signal: AbortSignal.timeout(9000),
      headers: { 'User-Agent': 'TimeAndGames/0.1' },
    });
    if (!response.ok) throw new Error(`Steam HTTP ${response.status}`);
    const info = steamSearchSchema.parse((await response.json()) as unknown);
    res.json(
      info.items.slice(0, 24).map((i) => ({
        appid: i.id,
        name: i.name,
        poster: steamPoster(i.id),
        thumbnail: i.tiny_image || '',
      })),
    );
  } catch (e) {
    error(res, 502, 'Steam сейчас недоступен: ' + errorMessage(e));
  }
});

function scanInstalledSteamGames(customPath?: string) {
  if (process.platform !== 'win32') return [];
  const roots = [
    customPath,
    process.env.TNG_STEAM_PATH,
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ].filter(Boolean);
  const dirs = new Set<string>();
  for (const root of roots) {
    if (!root) continue;
    const steamapps = path.join(root, 'steamapps');
    if (!existsSync(steamapps)) continue;
    dirs.add(steamapps);
    const cfg = path.join(steamapps, 'libraryfolders.vdf');
    if (existsSync(cfg)) {
      const content = readFileSync(cfg, 'utf8');
      for (const match of content.matchAll(/"path"\s+"([^"]+)"/gi)) {
        const location = (match[1] ?? '').replace(/\\\\/g, '\\');
        const dir = path.join(location, 'steamapps');
        if (existsSync(dir)) dirs.add(dir);
      }
    }
  }
  const found = new Map<number, GameInput>();
  for (const dir of dirs) {
    for (const f of readdirSync(dir)) {
      const match = /^appmanifest_(\d+)\.acf$/i.exec(f);
      if (!match) continue;
      try {
        const acf = readFileSync(path.join(dir, f), 'utf8');
        const name = /"name"\s+"([^"]+)"/i.exec(acf)?.[1];
        const appid = Number(match[1]);
        if (name && Number.isSafeInteger(appid))
          found.set(appid, { steam_appid: appid, name, poster: steamPoster(appid) });
      } catch {
        /* malformed manifest: skip */
      }
    }
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
  const key = textField(settingsInputSchema.parse(req.body).api_key, 300),
    steamId = textField(settingsInputSchema.parse(req.body).steam_id, 30);
  if (!/^\d{17}$/.test(steamId) || !/^[0-9A-Fa-f]{32}$/.test(key)) {
    error(res, 400, 'Укажи SteamID64 (17 цифр) и Web API Key (32 символа)');
    return;
  }
  try {
    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
    url.searchParams.set('key', key);
    url.searchParams.set('steamid', steamId);
    url.searchParams.set('include_appinfo', 'true');
    url.searchParams.set('include_played_free_games', 'true');
    const response = await fetch(url, { signal: AbortSignal.timeout(14000) });
    if (!response.ok) throw new Error(`Steam API HTTP ${response.status}`);
    const data = steamOwnedSchema.parse((await response.json()) as unknown);
    const list = data.response.games;
    if (!Array.isArray(list)) {
      error(res, 422, 'Steam не вернул список. Проверь SteamID, ключ и настройки приватности');
      return;
    }
    const result = importGames(
      list.map((g) => ({
        steam_appid: g.appid,
        name: g.name,
        poster: steamPoster(g.appid),
        playtime_minutes: g.playtime_forever || 0,
      })),
    );
    res.json({ found: list.length, ...result });
  } catch (e) {
    error(res, 502, 'Не удалось получить библиотеку Steam: ' + errorMessage(e));
  }
});

api.post('/api/reset', (req, res) => {
  if (settingsInputSchema.parse(req.body).confirmation !== 'СБРОСИТЬ') {
    error(res, 400, 'Для сброса требуется подтверждение СБРОСИТЬ');
    return;
  }
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM sessions; DELETE FROM games; DELETE FROM categories;');
    seedCategories();
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw e;
  }
});
const backupTables = ['categories', 'games', 'sessions'] as const;
api.get('/api/export', (_req, res) => {
  const data: Record<string, unknown> = {
    format: 'time-and-games-backup',
    version: 1,
    exported_at: new Date().toISOString(),
  };
  for (const table of backupTables) data[table] = db.prepare('SELECT * FROM ' + table).all();
  res.setHeader('Content-Disposition', 'attachment; filename="time-and-games-backup.json"');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(data, null, 2));
});
api.post('/api/import-backup', (req, res) => {
  const data = backupSchema.parse(req.body);
  if (data.categories.length > 500 || data.games.length > 20000 || data.sessions.length > 200000) {
    error(res, 413, 'Слишком большая резервная копия');
    return;
  }
  try {
    const categoryIds = new Set<string>(),
      gameIds = new Set<string>(),
      sessionIds = new Set<string>(),
      activeCategories = new Set<string>();
    for (const c of data.categories) {
      if (
        typeof c.id !== 'string' ||
        !c.id ||
        categoryIds.has(c.id) ||
        !textField(c.name, 55) ||
        !textField(c.group_name, 40) ||
        !/^#[0-9a-fA-F]{6}$/.test(c.color) ||
        ![0, 1, false, true].includes(c.is_work) ||
        !Number.isSafeInteger(c.sort_order)
      )
        throw new Error('Некорректная категория');
      categoryIds.add(c.id);
    }
    for (const g of data.games) {
      if (typeof g.id !== 'string' || !g.id || gameIds.has(g.id)) throw new Error('Некорректная игра');
      validateGame(g, true);
      gameIds.add(g.id);
    }
    for (const s of data.sessions) {
      if (
        typeof s.id !== 'string' ||
        !s.id ||
        sessionIds.has(s.id) ||
        !categoryIds.has(s.category_id) ||
        (s.game_id && !gameIds.has(s.game_id)) ||
        !timestamp(s.start_at) ||
        (s.end_at !== null && (!timestamp(s.end_at) || s.end_at <= s.start_at))
      )
        throw new Error('Некорректная сессия');
      if (s.end_at === null && activeCategories.has(s.category_id))
        throw new Error('Два активных таймера одной категории');
      if (s.end_at === null) activeCategories.add(s.category_id);
      sessionIds.add(s.id);
    }
    const cols: Record<'categories' | 'games' | 'sessions', string[]> = {
      categories: ['id', 'group_name', 'name', 'color', 'icon', 'is_work', 'sort_order'],
      games: [
        'id',
        'steam_appid',
        'name',
        'poster',
        'status',
        'rating',
        'review',
        'started_at',
        'completed_at',
        'playtime_minutes',
        'created_at',
      ],
      sessions: ['id', 'category_id', 'game_id', 'title', 'note', 'start_at', 'end_at', 'created_at'],
    };
    db.exec('BEGIN');
    for (const t of ['sessions', 'games', 'categories']) db.exec('DELETE FROM ' + t);
    for (const table of backupTables) {
      const c = cols[table],
        sql =
          'INSERT INTO ' + table + ' (' + c.join(',') + ') VALUES (' + c.map(() => '?').join(',') + ')';
      const statement = db.prepare(sql);
      for (const row of data[table]) {
        const values: Record<string, unknown> = { ...row };
        statement.run(
          ...c.map((k): SQLInputValue => {
            const v = values[k];
            if (v == null) return null;
            if (typeof v === 'boolean') return Number(v);
            if (typeof v === 'string' || typeof v === 'number') return v;
            throw new Error('Неверное значение в резервной копии');
          }),
        );
      }
    }
    db.exec('COMMIT');
    res.json({
      ok: true,
      categories: data.categories.length,
      games: data.games.length,
      sessions: data.sessions.length,
    });
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    error(res, 400, 'Не удалось восстановить данные: ' + errorMessage(e));
  }
});
api.use('/api', (_req, res) => {
  error(res, 404, 'Неизвестный API маршрут');
});
api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
const PORT = process.env.TNG_PORT === undefined ? 3535 : Number(process.env.TNG_PORT);
const HOST = '127.0.0.1';
const server = api.listen(PORT, HOST, () => {
  console.log(`Time & Games running at http://${HOST}:${(server.address() as AddressInfo).port}`);
});
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
