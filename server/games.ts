import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Game } from '../src/shared/api/contracts.ts';
import type { GameInput } from '../src/shared/api/inputContracts.ts';
import { ensure } from './http.ts';

const statuses = new Set(['backlog', 'playing', 'completed', 'paused', 'dropped']);
const text = (value: string | undefined, max: number) => (value ?? '').trim().slice(0, max);
export function validDate(value: string | null | undefined): boolean {
  if (!value) return true;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function validPoster(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
function validateGameNumbers(game: GameInput): void {
  const rating = game.rating;
  if (rating !== undefined && rating !== null)
    ensure(
      Number.isInteger(rating * 2) && rating >= 0.5 && rating <= 10,
      'Оценка должна быть от 0,5 до 10 с шагом 0,5',
    );
  if (game.playtime_minutes !== undefined)
    ensure(
      Number.isInteger(game.playtime_minutes) && game.playtime_minutes >= 0,
      'Неверное время в игре',
    );
}
export function validateGame(game: GameInput, isNew: boolean): void {
  if (isNew || game.name !== undefined) ensure(text(game.name, 160), 'Укажи название игры');
  if (game.poster) ensure(validPoster(game.poster), 'Постер должен быть HTTPS-ссылкой');
  if (game.started_at && game.completed_at)
    ensure(game.completed_at >= game.started_at, 'Дата прохождения должна быть не раньше начала');
  if (game.status !== undefined) ensure(statuses.has(game.status), 'Неизвестный статус игры');
  ensure(validDate(game.started_at) && validDate(game.completed_at), 'Неверная дата');
  validateGameNumbers(game);
}
export function steamAppId(value: GameInput['steam_appid']): number | null {
  return value && Number.isSafeInteger(value) && value > 0 ? value : null;
}
export const steamPoster = (appid: number) =>
  `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
export function newGame(input: GameInput, appid: number | null): Game {
  return {
    id: randomUUID(),
    steam_appid: appid,
    name: text(input.name, 160),
    poster: text(input.poster, 800) || (appid ? steamPoster(appid) : ''),
    status: input.status ?? 'backlog',
    favorite: input.favorite ?? false,
    rating: input.rating ?? null,
    review: text(input.review, 10000),
    started_at: input.started_at || null,
    completed_at: input.completed_at || null,
    playtime_minutes: input.playtime_minutes ?? 0,
    created_at: Date.now(),
  };
}
export function gamePatch(old: Game, input: GameInput): Game {
  const game = {
    ...old,
    ...input,
    name: text(input.name ?? old.name, 160),
    poster: text(input.poster ?? old.poster, 800),
    review: text(input.review ?? old.review, 10000),
    started_at: input.started_at === undefined ? old.started_at : input.started_at || null,
    completed_at: input.completed_at === undefined ? old.completed_at : input.completed_at || null,
  };
  ensure(game.name, 'Название не может быть пустым');
  return game;
}
function updateBindings(game: Game) {
  return {
    id: game.id,
    name: game.name,
    poster: game.poster,
    status: game.status,
    favorite: Number(game.favorite),
    rating: game.rating,
    review: game.review,
    started_at: game.started_at,
    completed_at: game.completed_at,
    playtime_minutes: game.playtime_minutes,
  };
}
export function insertGameRecord(db: DatabaseSync, game: Game): void {
  db.prepare(
    'INSERT INTO games (id,steam_appid,name,poster,status,favorite,rating,review,started_at,completed_at,playtime_minutes,created_at) VALUES (@id,@steam_appid,@name,@poster,@status,@favorite,@rating,@review,@started_at,@completed_at,@playtime_minutes,@created_at)',
  ).run({ ...updateBindings(game), steam_appid: game.steam_appid, created_at: game.created_at });
}
export function updateGameRecord(db: DatabaseSync, game: Game): void {
  db.prepare(
    'UPDATE games SET name=@name,poster=@poster,status=@status,favorite=@favorite,rating=@rating,review=@review,started_at=@started_at,completed_at=@completed_at,playtime_minutes=@playtime_minutes WHERE id=@id',
  ).run(updateBindings(game));
}
