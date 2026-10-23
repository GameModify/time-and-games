import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Session } from '../src/shared/api/contracts.ts';
import type { SessionWriteDto } from '../src/shared/api/inputContracts.ts';
import { ensure } from './http.ts';
export const timestamp = (value: unknown): number | null =>
  (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0
    ? Number(value)
    : null;
interface SessionPlan {
  input: SessionWriteDto;
  categoryIds: string[];
  start: number;
  end: number | null;
  createdAt: number;
}
function checkLinks(db: DatabaseSync, categoryId: string, gameId: string | null): void {
  ensure(db.prepare('SELECT id FROM categories WHERE id=?').get(categoryId), 'Категория не найдена');
  if (gameId) ensure(db.prepare('SELECT id FROM games WHERE id=?').get(gameId), 'Игра не найдена');
}
function checkActive(db: DatabaseSync, categoryId: string, ownId = ''): void {
  ensure(
    !db
      .prepare('SELECT id FROM sessions WHERE category_id=? AND end_at IS NULL AND id<>?')
      .get(categoryId, ownId),
    'Таймер этой категории уже запущен',
    409,
  );
}
function sessionBounds(input: SessionWriteDto) {
  const start = input.start_at === undefined ? Date.now() : timestamp(input.start_at);
  const end = input.end_at == null ? null : timestamp(input.end_at);
  ensure(
    start && (input.end_at == null || (end && end > start)),
    'Время окончания должно быть позже начала',
  );
  if (end === null) ensure(start <= Date.now(), 'Таймер не может начинаться в будущем');
  return { start, end };
}
export function sessionPlan(db: DatabaseSync, input: SessionWriteDto): SessionPlan {
  const categoryIds = [...new Set(input.category_ids ?? [input.category_id ?? ''])].filter(Boolean);
  ensure(categoryIds.length > 0 && categoryIds.length <= 15, 'Выбери от 1 до 15 категорий');
  const bounds = sessionBounds(input);
  for (const id of categoryIds) {
    checkLinks(db, id, input.game_id || null);
    if (bounds.end === null) checkActive(db, id);
  }
  return { input, categoryIds, ...bounds, createdAt: Date.now() };
}
export function newSession(plan: SessionPlan, categoryId: string): Session {
  return {
    id: randomUUID(),
    category_id: categoryId,
    game_id: plan.input.game_id || null,
    title: (plan.input.title ?? '').trim().slice(0, 160),
    note: (plan.input.note ?? '').trim().slice(0, 10000),
    start_at: plan.start,
    end_at: plan.end,
    created_at: plan.createdAt,
  };
}
export function sessionPatch(db: DatabaseSync, old: Session, input: SessionWriteDto): Session {
  const { start, end } = sessionBounds({
    ...input,
    start_at: input.start_at ?? old.start_at,
    end_at: input.end_at === undefined ? old.end_at : input.end_at,
  });
  const next = {
    ...old,
    category_id: input.category_id ?? old.category_id,
    game_id: input.game_id === undefined ? old.game_id : input.game_id || null,
    title: (input.title ?? old.title).trim().slice(0, 160),
    note: (input.note ?? old.note).trim().slice(0, 10000),
    start_at: start,
    end_at: end,
  };
  checkLinks(db, next.category_id, next.game_id);
  if (end === null) checkActive(db, next.category_id, old.id);
  return next;
}
export function sessionUpdateBindings(session: Session) {
  const { id, category_id, game_id, title, note, start_at, end_at } = session;
  return { id, category_id, game_id, title, note, start_at, end_at };
}
export function insertSession(db: DatabaseSync, session: Session): void {
  db.prepare(
    'INSERT INTO sessions (id,category_id,game_id,title,note,start_at,end_at,created_at) VALUES (@id,@category_id,@game_id,@title,@note,@start_at,@end_at,@created_at)',
  ).run({ ...sessionUpdateBindings(session), created_at: session.created_at });
}
