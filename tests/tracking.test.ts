import { test } from 'node:test';
import { unavailableConnection, totalDuration, addManualCoverage } from './tracking-data.ts';
import assert from 'node:assert/strict';
import { uncoveredRanges, importInterval } from '../server/tracking/import.ts';
import {
  configuration,
  inbox,
  storePage,
  updateConfiguration,
  markInbox,
} from '../server/tracking/storage.ts';
import { TrackingController } from '../server/tracking/controller.ts';
import { validateEndpoint } from '../server/tracking/http.ts';
import { interval, page, device, start, trackingDatabase } from './tracking-fixture.ts';
void test('overlap subtraction preserves uncovered time including nested intervals', () => {
  const range = { start_at: 0, end_at: 100 };
  assert.deepEqual(
    uncoveredRanges(range, [
      { start_at: 20, end_at: 80 },
      { start_at: 30, end_at: 40 },
    ]),
    [
      { start_at: 0, end_at: 20 },
      { start_at: 80, end_at: 100 },
    ],
  );
  assert.deepEqual(uncoveredRanges(range, [{ start_at: -10, end_at: 150 }]), []);
});
void test('repeated import and changed snapshots cannot recreate deleted sessions', () => {
  const db = trackingDatabase(),
    item = interval(),
    key = { id: item.id, device_id: device, category_id: 'coding' };
  try {
    storePage(db, page(item));
    assert.equal(importInterval(db, key), 1);
    db.prepare('UPDATE sessions SET title=?').run('Manual correction');
    storePage(db, page({ ...item, sequence: 2, title: 'Changed upstream' }));
    assert.equal(db.prepare('SELECT title FROM sessions').get()?.title, 'Manual correction');
    db.exec('DELETE FROM sessions');
    assert.equal(importInterval(db, key), 0);
    assert.equal(inbox(db).length, 0);
  } finally {
    db.close();
  }
});
void test('manual overlap is not counted again during tracker import', () => {
  const db = trackingDatabase(),
    item = interval();
  try {
    addManualCoverage(db, start);
    storePage(db, page(item));
    assert.equal(importInterval(db, { id: item.id, device_id: device, category_id: 'coding' }), 2);
    assert.equal(totalDuration(db), 100000);
  } finally {
    db.close();
  }
});
void test('ignored and unfinished observations never appear as pending completed entries', () => {
  const db = trackingDatabase(),
    item = interval();
  try {
    storePage(db, page(item));
    markInbox(db, { id: item.id, device_id: device }, 'ignored');
    storePage(db, page({ ...item, sequence: 2 }));
    storePage(db, page(interval({ closed: false, sequence: 3 })));
    assert.deepEqual(inbox(db), []);
  } finally {
    db.close();
  }
});
void test('tracker is disabled by default and cannot prevent manual site operation', async () => {
  const db = trackingDatabase(),
    controller = new TrackingController(db);
  try {
    assert.equal(configuration(db).enabled, false);
    assert.equal(await controller.sync(), 0);
    updateConfiguration(db, unavailableConnection);
    assert.equal(await controller.sync(), 0);
    assert.equal(controller.state().connected, false);
    assert.ok(controller.state().error);
    assert.equal('token' in controller.state().settings, false);
  } finally {
    db.close();
  }
});
void test('automatic import uses explicit mappings and leaves unknown activity for review', () => {
  const db = trackingDatabase(),
    controller = new TrackingController(db);
  try {
    updateConfiguration(db, {
      enabled: true,
      endpoint: 'http://127.0.0.1:3536',
      auto_import: true,
      mappings: [{ activity: 'coding', category_id: 'coding' }],
    });
    storePage(db, page(interval()));
    storePage(db, page(interval({ activity: null, sequence: 2 })));
    assert.equal(controller.autoImport(), 1);
    assert.equal(inbox(db).length, 1);
  } finally {
    db.close();
  }
});
void test('connection is restricted to loopback and disallows credentials or extra paths', () => {
  assert.equal(validateEndpoint('http://127.0.0.1:3536'), 'http://127.0.0.1:3536');
  for (const url of [
    'https://example.org',
    'http://localhost:3536',
    'http://user:pass@127.0.0.1:3536',
    'http://127.0.0.1:3536/other',
  ]) {
    assert.throws(() => validateEndpoint(url));
  }
});

void test('unmapped review backlog cannot hide eligible automatic imports', () => {
  const db = trackingDatabase(),
    controller = new TrackingController(db);
  try {
    updateConfiguration(db, {
      enabled: true,
      endpoint: 'http://127.0.0.1:3536',
      auto_import: true,
      mappings: [{ activity: 'coding', category_id: 'coding' }],
    });
    storePage(db, page(interval()));
    for (let index = 0; index < 205; index++)
      storePage(db, page(interval({ activity: null, sequence: index + 2 })));
    assert.equal(inbox(db).length, 200);
    assert.equal(controller.autoImport(), 1);
  } finally {
    db.close();
  }
});
