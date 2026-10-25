import type { DatabaseSync } from 'node:sqlite';
import type { TrackerInterval, TrackerRule } from '../src/shared/api/trackingContracts.ts';
import { interval, page, device, trackingDatabase, start } from './tracking-fixture.ts';
import { configuration, storePage, updateConfiguration } from '../server/tracking/storage.ts';
import { importInterval } from '../server/tracking/import.ts';
export function websiteDatabase(): DatabaseSync {
  const db = trackingDatabase();
  db.exec("INSERT INTO categories VALUES ('web'),('watch')");
  updateConfiguration(db, {
    ...configuration(db),
    enabled: true,
    auto_import: true,
    token: 'a'.repeat(64),
    mappings: [
      { activity: 'web', category_id: 'web' },
      { activity: 'projects', category_id: 'coding' },
    ],
  });
  return db;
}
export function addSite(db: DatabaseSync, patch: Partial<TrackerInterval> = {}): TrackerInterval {
  const item = interval({ website: 'work.example', activity: 'web', app: 'chrome.exe', ...patch });
  storePage(db, page(item));
  importInterval(db, { id: item.id, device_id: device, category_id: 'web' });
  return item;
}
export function siteRule(patch: Partial<TrackerRule> = {}): TrackerRule {
  return {
    id: crypto.randomUUID(),
    name: 'Work',
    enabled: true,
    field: 'host',
    operator: 'equals',
    value: 'work.example',
    scope: 'focus',
    activity: 'tng:coding',
    priority: 200,
    project: 'Qualify',
    ...patch,
  };
}
export function oldSites(db: DatabaseSync): void {
  addSite(db, { start_at: start + 86400000, end_at: start + 86400000 + 1000 });
  addSite(db, { start_at: start, end_at: start + 1000 });
}
