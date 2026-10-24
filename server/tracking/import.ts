import { trackingContext } from './context.ts';
import { linkAutomatic } from './grouping.ts';
import { rememberResource, intervalGame } from './bindings.ts';
import type { DatabaseSync } from 'node:sqlite';
import type { TrackingImport, TrackingInboxItem } from '../../src/shared/api/trackingContracts.ts';
import type { SessionWriteDto } from '../../src/shared/api/inputContracts.ts';
import { ensure } from '../http.ts';
import { insertSession, newSession, sessionPlan } from '../sessions.ts';
import { transaction } from '../storage.ts';
import { inboxItem, markInbox } from './storage.ts';
export interface TimeRange {
  start_at: number;
  end_at: number;
}
export function uncoveredRanges(range: TimeRange, covered: TimeRange[]): TimeRange[] {
  let segments = [range];
  for (const other of covered) {
    segments = segments.flatMap((part) => {
      if (other.end_at <= part.start_at || other.start_at >= part.end_at) return [part];
      const result: TimeRange[] = [];
      if (other.start_at > part.start_at)
        result.push({ start_at: part.start_at, end_at: other.start_at });
      if (other.end_at < part.end_at) result.push({ start_at: other.end_at, end_at: part.end_at });
      return result;
    });
  }
  return segments;
}
export function coveredRanges(db: DatabaseSync, category: string): TimeRange[] {
  return db
    .prepare('SELECT start_at,end_at FROM sessions WHERE category_id=?')
    .all(category)
    .map((row) => {
      return {
        start_at: Number(row.start_at),
        end_at: row.end_at === null ? Date.now() : Number(row.end_at),
      };
    });
}
export function importInterval(db: DatabaseSync, input: TrackingImport): number {
  const item = inboxItem(db, input);
  ensure(item, 'Интервал не найден', 404);
  if (item.state !== 'pending') return 0;
  ensure(item.closed && item.end_at > item.start_at, 'Интервал ещё не завершён');
  ensure(
    db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.category_id),
    'Категория не найдена',
  );
  const ranges = uncoveredRanges(item, coveredRanges(db, input.category_id));
  transaction(db, () => {
    for (const range of ranges) insertRange(db, item, range, input.category_id);
    if (input.remember) rememberResource(db, item, input.category_id);
    markInbox(db, input, 'imported');
  });
  return ranges.length;
}

function intervalInput(
  db: DatabaseSync,
  item: TrackingInboxItem,
  range: TimeRange,
  category: string,
): SessionWriteDto {
  return { ...range, category_id: category, title: item.title, game_id: intervalGame(db, item) };
}

function insertRange(
  db: DatabaseSync,
  item: TrackingInboxItem,
  range: TimeRange,
  category: string,
): void {
  const session = newSession(sessionPlan(db, intervalInput(db, item, range, category)), category);
  insertSession(db, { ...session, tracking_context: trackingContext(item) });
  linkAutomatic(db, item, category, session.id);
}
