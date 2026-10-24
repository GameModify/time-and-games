import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackingDatabase, start } from './tracking-fixture.ts';
import {
  initializeTimers,
  pausedTimers,
  exportTimerGroups,
  restoreTimerGroups,
} from '../server/timers/storage.ts';
import { pauseTimer, resumeTimer, finishPausedTimer } from '../server/timers/commands.ts';
import { insertSession, newSession, sessionPlan } from '../server/sessions.ts';
import type { Session } from '../src/shared/api/contracts.ts';
import { sessionSchema } from '../src/shared/api/contracts.ts';
import { readRows } from '../server/storage.ts';
import { summarize, timelineLayout } from '../src/entities/activity/index.ts';
function timerFixture() {
  const db = trackingDatabase();
  initializeTimers(db);
  const session = newSession(
    sessionPlan(db, { category_id: 'coding', start_at: start, title: 'Project', note: 'Result' }),
    'coding',
  );
  insertSession(db, session);
  return { db, session };
}
void test('pause and resume accumulate segments and leave a real gap in statistics and timeline', () => {
  const { db, session } = timerFixture();
  try {
    pauseTimer(db, session.id, start + 5000);
    const next = resumeTimer(db, session.id, start + 65000);
    assert.equal(next.elapsed_before, 5000);
    assert.equal(next.note, 'Result');
    pauseTimer(db, next.id, start + 70000);
    const rows = readRows(db, 'SELECT * FROM sessions ORDER BY start_at', sessionSchema);
    assertGap(rows);
    const paused = pausedTimers(db)[0];
    assert.equal(paused?.elapsed_before, 5000);
    assert.equal(paused.end_at, start + 70000);
  } finally {
    db.close();
  }
});
void test('duplicate pause/resume and category conflicts cannot duplicate or lose a paused timer', () => {
  const { db, session } = timerFixture();
  try {
    pauseTimer(db, session.id, start + 5000);
    assert.throws(() => pauseTimer(db, session.id, start + 6000));
    const other = newSession(
      sessionPlan(db, { category_id: 'coding', start_at: start + 10000 }),
      'coding',
    );
    insertSession(db, other);
    assert.throws(() => resumeTimer(db, session.id, start + 20000));
    assert.equal(pausedTimers(db).length, 1);
    db.prepare('DELETE FROM sessions WHERE id=?').run(other.id);
    resumeTimer(db, session.id, start + 30000);
    assert.throws(() => resumeTimer(db, session.id, start + 31000));
    assert.equal(pausedTimers(db).length, 0);
  } finally {
    db.close();
  }
});
void test('paused group restoration preserves identity and finishing does not add the break', () => {
  const { db, session } = timerFixture();
  try {
    pauseTimer(db, session.id, start + 5000);
    const groups = exportTimerGroups(db);
    restoreTimerGroups(db, groups);
    assert.equal(pausedTimers(db)[0]?.timer_id, session.id);
    finishPausedTimer(db, session.id);
    assert.equal(pausedTimers(db).length, 0);
    assert.equal(db.prepare('SELECT end_at-start_at AS elapsed FROM sessions').get()?.elapsed, 5000);
  } finally {
    db.close();
  }
});

function assertGap(rows: Session[]): void {
  assert.equal(summarize(rows, [], start, start + 100000).total, 10000);
  assert.deepEqual(
    timelineLayout(rows, start, start + 100000).map((item) => [item.start, item.end]),
    [
      [start, start + 5000],
      [start + 65000, start + 70000],
    ],
  );
}
