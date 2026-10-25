import type { DatabaseSync } from 'node:sqlite';
import type { Session } from '../src/shared/api/contracts.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synchronizeWebsiteRules, websiteInterval } from '../server/tracking/website-rules.ts';
import { classifyWebsite } from '../server/tracking/website-classification.ts';
import { rangeSessions, liveSessions } from '../server/tracking/live.ts';
import { configuration, storePage, inbox } from '../server/tracking/storage.ts';
import { intervalCategory } from '../server/tracking/bindings.ts';
import { importInterval } from '../server/tracking/import.ts';
import { interval, page, device, start } from './tracking-fixture.ts';
import { websiteDatabase, oldSites, addSite, siteRule } from './website-history-fixture.ts';
import { withRuleHttp } from './rule-http-fixture.ts';
import { activityTracksInRange, categoryLanes } from '../src/entities/activity/index.ts';
const range = { from: start, to: start + 86400000 + 200000 };
void test('website history moves across dates and graph lanes without altering bounds or identities', () => {
  const db = websiteDatabase();
  try {
    oldSites(db);
    const before = rangeSessions(db, range.from, range.to);
    synchronizeWebsiteRules(db, [siteRule()]);
    const after = rangeSessions(db, range.from, range.to);
    checkHistoricalGraph(before, after);
  } finally {
    db.close();
  }
});
void test('exact domains change without altering other sites, media, notes or interval count', () => {
  const db = websiteDatabase();
  try {
    seedSeparateSources(db);
    synchronizeWebsiteRules(db, [siteRule()]);
    const rows = rangeSessions(db, range.from, range.to);
    assert.equal(rows.length, 3);
    assert.equal(rows.find((row) => row.tracking_context?.media_id)?.category_id, 'web');
    const other = rows.find((row) => row.tracking_context?.website === 'other.example');
    assert.equal(other?.category_id, 'web');
    synchronizeWebsiteRules(db, [siteRule({ activity: 'tng:watch', project: 'Other' })]);
    assert.equal(
      rangeSessions(db, range.from, range.to).filter((row) => row.category_id === 'watch').length,
      1,
    );
  } finally {
    db.close();
  }
});
void test('repeating and resetting a site assignment preserves records and removes project metadata', () => {
  const db = websiteDatabase();
  try {
    oldSites(db);
    const rule = siteRule();
    synchronizeWebsiteRules(db, [rule]);
    synchronizeWebsiteRules(db, [rule]);
    synchronizeWebsiteRules(db, [siteRule({ activity: 'tng:web', project: undefined })]);
    const rows = rangeSessions(db, range.from, range.to);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.category_id === 'web' && !row.tracking_context?.project));
    assert.equal(configuration(db).website_rules.length, 1);
  } finally {
    db.close();
  }
});
void test('active and late intervals use the current site policy instead of stale collector metadata', () => {
  const db = websiteDatabase();
  try {
    synchronizeWebsiteRules(db, [siteRule()]);
    const item = interval({ website: 'work.example', activity: null, closed: false });
    storePage(db, page(item));
    assert.equal(liveSessions(db)[0]?.category_id, 'coding');
    assert.equal(liveSessions(db)[0]?.tracking_context?.project, 'Qualify');
    storePage(db, page({ ...item, sequence: 2, closed: true }));
    const category = intervalCategory(db, websiteInterval(db, item), configuration(db).mappings);
    assert.equal(category, 'coding');
    assert.equal(importInterval(db, { id: item.id, device_id: device, category_id: category }), 1);
    assert.equal(importInterval(db, { id: item.id, device_id: device, category_id: category }), 0);
    assert.equal(rangeSessions(db, range.from, range.to)[0]?.tracking_context?.project, 'Qualify');
  } finally {
    db.close();
  }
});
void test('an unavailable tracker cannot partially rewrite historical site data', () =>
  withRuleHttp(async (fixture) => {
    const db = websiteDatabase();
    try {
      oldSites(db);
      const before = rangeSessions(db, range.from, range.to);
      fixture.unavailable = true;
      await assert.rejects(
        classifyWebsite(db, { host: 'work.example', category_id: 'coding', project: 'Qualify' }),
      );
      assert.deepEqual(rangeSessions(db, range.from, range.to), before);
    } finally {
      db.close();
    }
  }));
void test('classification replaces the domain rule and supports resetting its entire history', () =>
  withRuleHttp(async (fixture) => {
    const db = websiteDatabase();
    try {
      oldSites(db);
      await classifyWebsite(db, { host: 'work.example', category_id: 'coding', project: 'Qualify' });
      const first = fixture.rules[0]?.id;
      await classifyWebsite(db, { host: 'work.example', category_id: 'web', project: '' });
      assert.equal(fixture.rules.length, 1);
      assert.equal(fixture.rules[0]?.id, first);
      assert.ok(rangeSessions(db, range.from, range.to).every((row) => row.category_id === 'web'));
    } finally {
      db.close();
    }
  }));
void test('disabled, invalid and media-only host rules cannot override a higher-priority focus rule', () => {
  const db = websiteDatabase();
  try {
    const main = siteRule({ priority: 300 });
    synchronizeWebsiteRules(db, [
      siteRule({ activity: 'tng:web' }),
      main,
      siteRule({ enabled: false, priority: 500 }),
      siteRule({ scope: 'media', priority: 600 }),
      siteRule({ value: 'https://bad.example/path' }),
    ]);
    assert.equal(configuration(db).website_rules.length, 1);
    assert.equal(websiteInterval(db, interval({ website: 'work.example' })).project, 'Qualify');
  } finally {
    db.close();
  }
});

function checkHistoricalGraph(before: Session[], after: Session[]): void {
  assert.deepEqual(
    after.map((row) => [row.id, row.start_at, row.end_at]),
    before.map((row) => [row.id, row.start_at, row.end_at]),
  );
  assert.ok(
    after.every((row) => row.category_id === 'coding' && row.tracking_context?.project === 'Qualify'),
  );
  const lanes = categoryLanes(activityTracksInRange(after, range, range.to), []);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0]?.id, 'coding');
  assert.equal(lanes[0].elapsed, 2000);
}

function seedSeparateSources(db: DatabaseSync): void {
  addSite(db);
  addSite(db, { website: 'other.example', start_at: start + 100000, end_at: start + 110000 });
  addSite(db, {
    website: 'work.example',
    media_id: 'video',
    start_at: start + 120000,
    end_at: start + 130000,
  });
}

void test('assigned pending websites are imported without letting unknown sites block mapped records', () => {
  const db = websiteDatabase();
  try {
    synchronizeWebsiteRules(db, [siteRule()]);
    const assigned = interval({ website: 'work.example', activity: null });
    const unknown = interval({ website: 'unknown.example', activity: null });
    storePage(db, page(assigned));
    storePage(db, page(unknown));
    assert.deepEqual(
      inbox(db, ['projects']).map((item) => item.id),
      [assigned.id],
    );
  } finally {
    db.close();
  }
});
