import { initializeTimers } from '../timers/storage.ts';
import { initializeBindings } from './bindings.ts';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  trackingConnectionSchema,
  trackerIntervalSchema,
  trackingInboxSchema,
} from '../../src/shared/api/trackingContracts.ts';
import type {
  TrackingConnection,
  TrackerPage,
  TrackingInboxItem,
  TrackingIgnore,
} from '../../src/shared/api/trackingContracts.ts';
import { transaction } from '../storage.ts';
const persistedSchema = trackingConnectionSchema.extend({
  token: z.string().default(''),
  cursor: z.number().int().nonnegative(),
  device_id: z.string(),
});
export type TrackingConfiguration = z.infer<typeof persistedSchema>;
const defaultConfiguration: TrackingConfiguration = {
  enabled: false,
  endpoint: 'http://127.0.0.1:3536',
  token: '',
  auto_import: false,
  mappings: [],
  cursor: 0,
  device_id: '',
};
export function initializeTracking(db: DatabaseSync): void {
  initializeBindings(db);
  initializeTimers(db);
  db.exec(
    'CREATE TABLE IF NOT EXISTS tracking_configuration (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);',
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS tracking_inbox (device_id TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(device_id,id));",
  );
}
export function configuration(db: DatabaseSync): TrackingConfiguration {
  const row = db.prepare('SELECT value FROM tracking_configuration WHERE id=1').get();
  return row
    ? persistedSchema.parse(JSON.parse(z.string().parse(row.value)))
    : { ...defaultConfiguration };
}
export function saveConfiguration(db: DatabaseSync, value: TrackingConfiguration): void {
  db.prepare('INSERT OR REPLACE INTO tracking_configuration VALUES (1,?)').run(JSON.stringify(value));
}
export function updateConfiguration(db: DatabaseSync, input: TrackingConnection): void {
  const old = configuration(db),
    token = input.token === undefined ? old.token : input.token;
  const changed = input.endpoint !== old.endpoint || token !== old.token;
  saveConfiguration(db, {
    ...old,
    ...input,
    token,
    cursor: changed ? 0 : old.cursor,
    device_id: changed ? '' : old.device_id,
  });
}
export function storePage(db: DatabaseSync, page: TrackerPage): void {
  transaction(db, () => {
    const insert = db.prepare(
      "INSERT INTO tracking_inbox (device_id,id,value) VALUES (?,?,?) ON CONFLICT(device_id,id) DO UPDATE SET value=excluded.value WHERE tracking_inbox.state='pending'",
    );
    for (const item of page.intervals) insert.run(page.device_id, item.id, JSON.stringify(item));
    saveConfiguration(db, { ...configuration(db), cursor: page.cursor, device_id: page.device_id });
  });
}
export function inbox(db: DatabaseSync, activities?: string[]): TrackingInboxItem[] {
  const filter = inboxFilter(activities);
  const query =
    "SELECT * FROM tracking_inbox WHERE state='pending' AND json_extract(value,'$.closed')=1 AND json_extract(value,'$.end_at')>json_extract(value,'$.start_at')";
  return db
    .prepare(query + filter + ' ORDER BY rowid DESC LIMIT 200')
    .all(...(activities ?? []))
    .map((row) => {
      const value: unknown = JSON.parse(z.string().parse(row.value));
      return trackingInboxSchema.parse({
        ...trackerIntervalSchema.parse(value),
        device_id: row.device_id,
        state: row.state,
      });
    });
}
export function inboxItem(db: DatabaseSync, key: TrackingIgnore): TrackingInboxItem | undefined {
  const row = db
    .prepare('SELECT * FROM tracking_inbox WHERE device_id=? AND id=?')
    .get(key.device_id, key.id);
  if (!row) return undefined;
  return trackingInboxSchema.parse({
    ...trackerIntervalSchema.parse(JSON.parse(z.string().parse(row.value))),
    device_id: row.device_id,
    state: row.state,
  });
}
export function markInbox(db: DatabaseSync, key: TrackingIgnore, state: 'imported' | 'ignored'): void {
  db.prepare('UPDATE tracking_inbox SET state=? WHERE device_id=? AND id=?').run(
    state,
    key.device_id,
    key.id,
  );
}

export function openInbox(db: DatabaseSync, device: string): TrackingInboxItem[] {
  return db
    .prepare(
      "SELECT * FROM tracking_inbox WHERE state='pending' AND device_id=? AND json_extract(value,'$.closed')=0 AND json_extract(value,'$.end_at')>json_extract(value,'$.start_at')",
    )
    .all(device)
    .map((row) =>
      trackingInboxSchema.parse({
        ...trackerIntervalSchema.parse(JSON.parse(z.string().parse(row.value))),
        device_id: row.device_id,
        state: row.state,
      }),
    );
}

function inboxFilter(activities?: string[]): string {
  if (activities === undefined) return '';
  const selection = activities.map(() => '?').join(',');
  const mapped = selection ? "json_extract(value,'$.activity') IN (" + selection + ') OR ' : '';
  return (
    ' AND (' +
    mapped +
    "EXISTS (SELECT 1 FROM tracking_bindings b WHERE b.resource_id=json_extract(value,'$.resource_id') AND b.source=json_extract(value,'$.source')))"
  );
}
