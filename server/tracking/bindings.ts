import type { DatabaseSync } from 'node:sqlite';
import type {
  TrackingInboxItem,
  TrackingConnection,
  TrackerInterval,
} from '../../src/shared/api/trackingContracts.ts';
import { z } from 'zod';
const bindingSchema = z.object({ category_id: z.string() });
export function initializeBindings(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS tracking_bindings (source TEXT NOT NULL,resource_id TEXT NOT NULL,category_id TEXT NOT NULL,PRIMARY KEY(source,resource_id))',
  );
}
export function rememberResource(db: DatabaseSync, item: TrackingInboxItem, category: string): void {
  if (!item.resource_id) return;
  db.prepare('INSERT OR REPLACE INTO tracking_bindings VALUES (?,?,?)').run(
    item.source,
    item.resource_id,
    category,
  );
}
export function intervalCategory(
  db: DatabaseSync,
  item: TrackerInterval,
  mappings: TrackingConnection['mappings'],
): string | undefined {
  if (item.activity?.startsWith('tng:')) return item.activity.slice(4);
  const row = item.resource_id
    ? db
        .prepare('SELECT category_id FROM tracking_bindings WHERE source=? AND resource_id=?')
        .get(item.source, item.resource_id)
    : undefined;
  return row
    ? bindingSchema.parse(row).category_id
    : mappings.find((mapping) => mapping.activity === item.activity)?.category_id;
}
export function intervalGame(
  db: DatabaseSync,
  item: Pick<TrackingInboxItem, 'resource_kind' | 'resource_id' | 'title'>,
): string | null {
  if (item.resource_kind !== 'game') return null;
  const identity = item.resource_id?.startsWith('steam-folder:')
    ? item.resource_id.slice(13)
    : item.title;
  const name = identity.toLocaleLowerCase();
  const rows = z
    .object({ id: z.string(), name: z.string() })
    .array()
    .parse(db.prepare('SELECT id,name FROM games').all());
  return rows.find((game) => game.name.toLocaleLowerCase() === name)?.id ?? null;
}
