import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveSessions, rangeSessions } from '../server/tracking/live.ts';
import {
  storePage,
  updateConfiguration,
  configuration,
  saveConfiguration,
} from '../server/tracking/storage.ts';
import { TrackingController } from '../server/tracking/controller.ts';
import { interval, page, device, start, trackingDatabase } from './tracking-fixture.ts';
import { totalDuration, addManualCoverage } from './tracking-data.ts';
import type { DatabaseSync } from 'node:sqlite';
function enableLive(db: DatabaseSync) {
  updateConfiguration(db, {
    enabled: true,
    endpoint: 'http://127.0.0.1:3536',
    auto_import: true,
    mappings: [{ activity: 'coding', category_id: 'coding' }],
  });
  saveConfiguration(db, { ...configuration(db), device_id: device });
}
void test('live tracking is finite, excludes manual overlap and becomes one saved interval on pause', () => {
  const db = trackingDatabase(),
    item = interval({ closed: false });
  try {
    enableLive(db);
    addManualCoverage(db, start);
    storePage(db, page(item));
    assertLiveCoverage(db);
    storePage(db, page({ ...item, closed: true, sequence: 2 }));
    new TrackingController(db).autoImport();
    assert.equal(liveSessions(db).length, 0);
    assert.equal(totalDuration(db), 100000);
    assert.equal(rangeSessions(db, start + 200000, start + 300000).length, 0);
  } finally {
    db.close();
  }
});
void test('disabled import and another tracker device cannot expose live sessions', () => {
  const db = trackingDatabase();
  try {
    storePage(db, page(interval({ closed: false })));
    assert.equal(liveSessions(db).length, 0);
    enableLive(db);
    assert.equal(liveSessions(db).length, 1);
    saveConfiguration(db, { ...configuration(db), device_id: crypto.randomUUID() });
    assert.equal(liveSessions(db).length, 0);
  } finally {
    db.close();
  }
});

function assertLiveCoverage(db: DatabaseSync): void {
  const rows = liveSessions(db);
  assert.equal(
    rows.reduce((sum, row) => sum + (row.end_at ?? 0) - row.start_at, 0),
    40000,
  );
  assert.ok(rows.every((row) => row.tracking_live && row.end_at !== null));
  assert.equal(totalDuration(db), 60000);
  assert.deepEqual(
    rows.map((row) => [row.start_at, row.end_at]),
    [
      [start, start + 20000],
      [start + 80000, start + 100000],
    ],
  );
}
