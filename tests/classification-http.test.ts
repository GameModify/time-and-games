import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertRule } from '../server/tracking/http.ts';
import { classificationRule, classifySession } from '../server/tracking/classification.ts';
import { trackingDatabase, interval, page, device, start } from './tracking-fixture.ts';
import { configuration, storePage, updateConfiguration } from '../server/tracking/storage.ts';
import { importInterval } from '../server/tracking/import.ts';
import { rangeSessions } from '../server/tracking/live.ts';
import { withRuleHttp } from './rule-http-fixture.ts';
import { sessionSchema } from '../src/shared/api/contracts.ts';
const input = { session_id: 'example', category_id: 'coding', scope: 'channel', project: '' } as const;
const session = sessionSchema.parse({
  id: 'example',
  category_id: 'coding',
  game_id: null,
  title: '',
  note: '',
  start_at: start,
  end_at: start + 1000,
  created_at: start,
  tracking_context: { media_creator: '/@lessons' },
});
void test('conditional rule update retries a conflict and preserves another channels changes', () =>
  withRuleHttp(async (fixture) => {
    const db = trackingDatabase();
    try {
      const rule = classificationRule(input, session, []);
      const concurrent = { ...rule, id: crypto.randomUUID(), value: '/@other' };
      fixture.conflict = concurrent;
      await upsertRule(configuration(db), rule);
      assert.equal(fixture.writes, 2);
      assert.equal(fixture.rules.length, 2);
      assert.equal(fixture.rules.find((item) => item.id === concurrent.id)?.value, '/@other');
    } finally {
      db.close();
    }
  }));
void test('failed rule delivery does not partially recategorize the chosen record', () =>
  withRuleHttp(async (fixture) => {
    const db = trackingDatabase();
    try {
      const item = interval({ media_creator: '/@lessons' });
      storePage(db, page(item));
      importInterval(db, { id: item.id, device_id: device, category_id: 'coding' });
      const saved = rangeSessions(db, start, start + 200000)[0];
      assert.ok(saved);
      updateConfiguration(db, { ...configuration(db), enabled: true, token: 'a'.repeat(64) });
      fixture.unavailable = true;
      await assert.rejects(classifySession(db, { ...input, session_id: saved.id, project: 'changed' }));
      assert.equal(rangeSessions(db, start, start + 200000)[0]?.tracking_context?.project, undefined);
      assert.equal(rangeSessions(db, start, start + 200000)[0]?.category_id, 'coding');
    } finally {
      db.close();
    }
  }));
