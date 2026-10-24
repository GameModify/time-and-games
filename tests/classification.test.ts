import type { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackingDatabase, interval, page, device, start } from './tracking-fixture.ts';
import { storePage } from '../server/tracking/storage.ts';
import { importInterval } from '../server/tracking/import.ts';
import { rangeSessions } from '../server/tracking/live.ts';
import { classifySession, classificationRule } from '../server/tracking/classification.ts';
import { classificationScopes } from '../src/pages/activity/model/classification.ts';
import { sessionSchema } from '../src/shared/api/contracts.ts';
import type { Session } from '../src/shared/api/contracts.ts';
import type { TrackerRule } from '../src/shared/api/trackingContracts.ts';
function session(): Session {
  return sessionSchema.parse({
    id: 'record',
    category_id: 'coding',
    game_id: null,
    title: 'Видео',
    note: '',
    start_at: start,
    end_at: start + 1000,
    created_at: start,
    tracking_context: { app: 'chrome.exe', media_id: 'abcdefghijk', media_creator: '/@lessons' },
  });
}
function seedSession(db: DatabaseSync): Session {
  db.exec("INSERT INTO categories VALUES ('watch')");
  const item = interval({ media_id: 'abcdefghijk', media_creator: '/@lessons', app: 'chrome.exe' });
  storePage(db, page(item));
  importInterval(db, { id: item.id, device_id: device, category_id: 'coding' });
  const old = rangeSessions(db, start, start + 200000)[0];
  assert.ok(old);
  return old;
}
void test('a single-record correction works without a tracker and retains its media identity', async () => {
  const db = trackingDatabase();
  try {
    const old = seedSession(db);
    await classifySession(db, {
      session_id: old.id,
      category_id: 'watch',
      scope: 'record',
      project: 'Учёба',
    });
    const current = rangeSessions(db, start, start + 200000)[0];
    assert.equal(current?.category_id, 'watch');
    assert.equal(current.tracking_context?.media_creator, '/@lessons');
    assert.equal(current.tracking_context.project, 'Учёба');
    assert.equal(current.start_at, old.start_at);
  } finally {
    db.close();
  }
});
void test('video and channel rules replace the same target, keep scope and propagate a project', () => {
  const input = {
    session_id: 'record',
    category_id: 'coding',
    scope: 'channel',
    project: 'Learning',
  } as const;
  const first = classificationRule(input, session(), []);
  const next = classificationRule({ ...input, category_id: 'watch' }, session(), [first]);
  assert.equal(next.id, first.id);
  assert.equal(next.field, 'media_creator');
  assert.equal(next.activity, 'tng:watch');
  assert.equal(next.scope, 'media');
  assert.equal(next.project, 'Learning');
  const video = classificationRule({ ...input, scope: 'video' }, session(), []);
  assert.ok(video.priority > next.priority);
});
void test('classification previews offer only known targets and never a global Chrome app rule', () => {
  const scopes = classificationScopes(session().tracking_context);
  assert.deepEqual(
    scopes.map((scope) => scope.value),
    ['record', 'video', 'channel'],
  );
  assert.match(scopes[2]?.detail ?? '', /@lessons/);
  assert.deepEqual(
    classificationScopes().map((scope) => scope.value),
    ['record'],
  );
  assert.throws(() =>
    classificationRule(
      { session_id: 'record', category_id: 'coding', scope: 'channel', project: '' },
      { ...session(), tracking_context: undefined },
      [],
    ),
  );
});
void test('video rule identity does not merge distinct case-sensitive YouTube IDs', () => {
  const input = { session_id: 'record', category_id: 'coding', scope: 'video', project: '' } as const;
  const first = classificationRule(input, session(), []);
  const upper = { ...session(), tracking_context: { media_id: 'Abcdefghijk' } };
  const rules: TrackerRule[] = [first];
  assert.notEqual(classificationRule(input, upper, rules).id, first.id);
});
