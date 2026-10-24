import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type { TrackerInterval } from '../src/shared/api/trackingContracts.ts';
import { trackingDatabase, interval, page, device, start } from './tracking-fixture.ts';
import { importInterval } from '../server/tracking/import.ts';
import { storePage, updateConfiguration } from '../server/tracking/storage.ts';
import { TrackingController } from '../server/tracking/controller.ts';
import { rangeSessions } from '../server/tracking/live.ts';
import { activityGroups } from '../src/entities/activity/index.ts';
function withDatabase(check: (db: DatabaseSync) => void): void {
  const db = trackingDatabase();
  try {
    check(db);
  } finally {
    db.close();
  }
}
function importItems(db: DatabaseSync, items: TrackerInterval[]): void {
  for (const item of items) {
    storePage(db, page(item));
    importInterval(db, { id: item.id, device_id: device, category_id: 'coding' });
  }
}
void test('pause intervals become one activity while gaps remain excluded from its total', () => {
  withDatabase((db) => {
    const first = interval({ source: 'chrome', channel: 'chrome:media:1' });
    const second = interval({
      ...first,
      id: crypto.randomUUID(),
      sequence: 2,
      start_at: start + 200000,
      end_at: start + 220000,
    });
    importItems(db, [first, second]);
    const groups = activityGroups(rangeSessions(db, start, start + 300000), start + 300000);
    assert.equal(groups.length, 1);
    const group = groups[0];
    assert.ok(group);
    assert.equal(group.elapsed, 120000);
    assert.equal(group.paused, 100000);
    assert.equal(group.segments.length, 2);
  });
});
function rememberDocument(db: DatabaseSync): TrackerInterval {
  const first = interval({
    activity: 'documents',
    resource_kind: 'document',
    resource_id: 'C:/Science/a.docx',
  });
  updateConfiguration(db, {
    enabled: true,
    endpoint: 'http://127.0.0.1:3536',
    auto_import: true,
    mappings: [],
  });
  storePage(db, page(first));
  importInterval(db, { id: first.id, device_id: device, category_id: 'coding', remember: true });
  return first;
}
function futureDocuments(db: DatabaseSync, first: TrackerInterval): void {
  const known = interval({
    ...first,
    id: crypto.randomUUID(),
    sequence: 2,
    start_at: start + 200000,
    end_at: start + 210000,
  });
  const unknown = interval({
    activity: 'documents',
    resource_kind: 'document',
    resource_id: 'C:/Other/b.docx',
    sequence: 3,
  });
  storePage(db, page(known));
  storePage(db, page(unknown));
}
void test('remembered documents import again without classifying unrelated files', () => {
  withDatabase((db) => {
    futureDocuments(db, rememberDocument(db));
    assert.equal(new TrackingController(db).autoImport(), 1);
    assert.equal(rangeSessions(db, start, start + 300000).length, 2);
  });
});
void test('an identified Steam game is linked to its library entry', () => {
  withDatabase((db) => {
    db.exec("CREATE TABLE games (id TEXT,name TEXT);INSERT INTO games VALUES ('game','Example Game')");
    importItems(db, [interval({ resource_kind: 'game', resource_id: 'steam-folder:example game' })]);
    assert.equal(rangeSessions(db, start, start + 200000)[0]?.game_id, 'game');
  });
});
