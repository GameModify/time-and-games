import type { DatabaseSync } from 'node:sqlite';
import { sessionSchema } from '../../src/shared/api/contracts.ts';
import { readRows, transaction } from '../storage.ts';
import type { TrackingInboxItem } from '../../src/shared/api/trackingContracts.ts';
import { configuration, inboxItem } from './storage.ts';
import { intervalCategory } from './bindings.ts';
import { linkAutomatic } from './grouping.ts';
import { z } from 'zod';
export function backfillGroups(db: DatabaseSync): void {
  const keys = readRows(
    db,
    "SELECT id,device_id FROM tracking_inbox WHERE state='imported'",
    z.object({ id: z.uuid(), device_id: z.uuid() }),
  );
  const config = configuration(db);
  transaction(db, () => {
    for (const key of keys) {
      const item = inboxItem(db, key);
      if (!item) continue;
      const category = intervalCategory(db, item, config.mappings);
      if (!category) continue;
      linkExisting(db, item, category);
    }
  });
}

function linkExisting(db: DatabaseSync, item: TrackingInboxItem, category: string): void {
  const rows = readRows(
    db,
    'SELECT * FROM sessions WHERE title=? AND category_id=? AND start_at>=? AND end_at<=? AND id NOT IN (SELECT session_id FROM timer_segments)',
    sessionSchema,
    [item.title, category, item.start_at, item.end_at],
  );
  for (const row of rows) linkAutomatic(db, item, category, row.id);
}
