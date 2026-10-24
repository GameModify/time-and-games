import { withSessionContext } from '../session-context.ts';
import { automaticGroup, withGroups } from './grouping.ts';
import { intervalCategory, intervalGame } from './bindings.ts';
import type { DatabaseSync } from 'node:sqlite';
import type { Session } from '../../src/shared/api/contracts.ts';
import { sessionSchema } from '../../src/shared/api/contracts.ts';
import { readRows } from '../storage.ts';
import { configuration, openInbox } from './storage.ts';
import { uncoveredRanges, coveredRanges } from './import.ts';
export function liveSessions(db: DatabaseSync): Session[] {
  const config = configuration(db);
  if (!config.enabled || !config.auto_import) return [];
  return openInbox(db, config.device_id).flatMap((item) => {
    const category = intervalCategory(db, item, config.mappings);
    if (!category || !db.prepare('SELECT 1 FROM categories WHERE id=?').get(category)) return [];
    return uncoveredRanges(item, coveredRanges(db, category)).map((range, index) => ({
      ...range,
      group_id: automaticGroup(item, category),
      id: 'tracking:' + item.id + ':' + String(index),
      category_id: category,
      game_id: intervalGame(db, item),
      title: item.title,
      note: '',
      created_at: item.start_at,
      tracking_live: true,
      tracking_context: { website: item.website, project: item.project },
    }));
  });
}
export function rangeSessions(db: DatabaseSync, from: number, to: number): Session[] {
  const saved = readRows(
    db,
    'SELECT * FROM sessions WHERE start_at < ? AND (end_at IS NULL OR end_at > ?) ORDER BY start_at DESC',
    sessionSchema,
    [to, from],
  );
  const live = liveSessions(db).filter((item) => item.start_at < to && (item.end_at ?? 0) > from);
  return [...withSessionContext(db, withGroups(db, saved)), ...live].sort(
    (a, b) => b.start_at - a.start_at,
  );
}
