import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { Session } from '../../src/shared/api/contracts.ts';
import type { TrackingInboxItem } from '../../src/shared/api/trackingContracts.ts';
import { readRows } from '../storage.ts';
export function automaticGroup(item: TrackingInboxItem, category: string): string {
  const day = new Date(item.start_at).toLocaleDateString('sv-SE');
  return (
    'auto:' +
    createHash('sha256')
      .update(
        [
          item.device_id,
          item.channel,
          day,
          category,
          item.project
            ? item.project + ':' + (item.resource_id ?? item.title)
            : (item.resource_id ?? item.title),
        ].join('\u001f'),
      )
      .digest('hex')
  );
}
export function linkAutomatic(
  db: DatabaseSync,
  item: TrackingInboxItem,
  category: string,
  session: string,
): void {
  const group = automaticGroup(item, category);
  db.prepare('INSERT OR IGNORE INTO timer_groups VALUES (?,0)').run(group);
  db.prepare('INSERT OR IGNORE INTO timer_segments VALUES (?,?)').run(session, group);
}
export function withGroups(db: DatabaseSync, sessions: Session[]): Session[] {
  const links = readRows(
    db,
    'SELECT session_id,group_id FROM timer_segments',
    z.object({ session_id: z.string(), group_id: z.string() }),
  );
  const ids = new Map(links.map((link) => [link.session_id, link.group_id]));
  return sessions.map((session) => ({ ...session, group_id: ids.get(session.id) }));
}
