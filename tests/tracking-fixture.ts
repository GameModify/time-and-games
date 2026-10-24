import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import type { TrackerInterval, TrackerPage } from '../src/shared/api/trackingContracts.ts';
import { initializeTracking } from '../server/tracking/storage.ts';
export const device = randomUUID(),
  start = 1000000;
export function interval(patch: Partial<TrackerInterval> = {}): TrackerInterval {
  return {
    id: randomUUID(),
    sequence: 1,
    channel: 'windows:focus',
    source: 'windows',
    activity: 'coding',
    title: 'Example project',
    start_at: start,
    end_at: start + 100000,
    rule_id: null,
    closed: true,
    ...patch,
  };
}
export function page(item: TrackerInterval): TrackerPage {
  return {
    api_version: 1,
    device_id: device,
    cursor: item.sequence,
    has_more: false,
    intervals: [item],
  };
}
export function trackingDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE categories (id TEXT PRIMARY KEY); INSERT INTO categories VALUES ('coding');");
  db.exec(
    'CREATE TABLE sessions (id TEXT PRIMARY KEY,category_id TEXT,game_id TEXT,title TEXT,note TEXT,start_at INTEGER,end_at INTEGER,created_at INTEGER);',
  );
  initializeTracking(db);
  return db;
}
