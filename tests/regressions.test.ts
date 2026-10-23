import { timelineRect } from '../src/entities/activity/lib/statistics.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, activityBuckets, timelineLayout } from '../src/entities/activity/lib/statistics.ts';
import { dayBounds } from '../src/shared/lib/date.ts';
import { playtimeFields, playtimeMinutes, completedInPeriod } from '../src/entities/game/lib/library.ts';
import { withGameTimes } from '../server/game-time.ts';
import { createBackdropDismiss } from '../src/features/record-editor/lib/backdrop.ts';

void test('finished records retain their full duration even when end is later than now', () => {
  const start = +new Date('2026-10-23T02:56:00'),
    now = start + 2 * 3600000;
  const cats = [{ id: 'film' }, { id: 'cooking' }, { id: 'project', is_work: true }];
  const sessions = [
    { category_id: 'film', start_at: start, end_at: start + 3 * 3600000 },
    { category_id: 'cooking', start_at: start + 119 * 60000, end_at: start + 179 * 60000 },
    { category_id: 'project', start_at: start + 2 * 3600000, end_at: start + 7 * 3600000 },
  ];
  const stats = summarize(sessions, cats, ...dayBounds('2026-10-23'), now);
  assert.deepEqual(
    stats.byCategory.map((c) => c.duration / 3600000),
    [3, 1, 5],
  );
  assert.equal(stats.total / 3600000, 7);
  assert.equal(stats.categoryTotal / 3600000, 9);
  assert.equal(stats.work / 3600000, 5);
});
void test('daily overview has hourly buckets while week has seven days', () => {
  assert.equal(activityBuckets([], [], '2026-10-23', 'day').length, 24);
  assert.equal(activityBuckets([], [], '2026-10-23', 'week').length, 7);
  assert.equal(activityBuckets([], [], '2026-10-23', 'month').length, 31);
});
void test('playtime can be cleared and is converted between hours and minutes', () => {
  assert.deepEqual(playtimeFields(0), { hours: '', minutes: '' });
  assert.deepEqual(playtimeFields(125), { hours: 2, minutes: 5 });
  assert.equal(playtimeMinutes('', ''), 0);
  assert.equal(playtimeMinutes('2', '5'), 125);
  assert.throws(() => playtimeMinutes(2, 60));
  assert.throws(() => playtimeMinutes(-1, 0));
});
void test('completion periods handle year boundaries, months and missing dates', () => {
  const game = { status: 'completed' as const, completed_at: '2025-12-31' };
  assert.equal(completedInPeriod(game, 'last-month', '2026-01-15'), true);
  assert.equal(completedInPeriod(game, 'year', '2026-01-15'), false);
  assert.equal(completedInPeriod(game, 'earlier', '2026-01-15'), true);
  assert.equal(completedInPeriod({ ...game, status: 'playing' }, 'earlier', '2026-01-15'), false);
  assert.equal(completedInPeriod({ ...game, completed_at: null }, 'undated'), true);
});
void test('game totals merge linked parallel sessions and avoid counting Steam twice', () => {
  const sessions = [
    { game_id: 'a', start_at: 0, end_at: 120 * 60000 },
    { game_id: 'a', start_at: 60 * 60000, end_at: 180 * 60000 },
  ];
  const [game] = withGameTimes([{ id: 'a', playtime_minutes: 200 }], sessions);
  assert.equal(game?.tracked_minutes, 180);
  assert.equal(game.total_minutes, 200);
  assert.equal(withGameTimes([{ id: 'a', playtime_minutes: 100 }], sessions)[0]?.total_minutes, 180);
});
void test('releasing a text-selection drag outside does not dismiss the form', () => {
  let dismissed = 0;
  const backdrop = new EventTarget(),
    inside = new EventTarget();
  let selection = '';
  const guard = createBackdropDismiss(
    () => dismissed++,
    () => selection,
  );
  guard.down({ button: 0, target: inside, currentTarget: backdrop });
  guard.up({ button: 0, target: backdrop, currentTarget: backdrop });
  assert.equal(dismissed, 0);
  selection = 'selected text';
  guard.down({ button: 0, target: backdrop, currentTarget: backdrop });
  guard.up({ button: 0, target: backdrop, currentTarget: backdrop });
  assert.equal(dismissed, 0);
  selection = '';
  guard.down({ button: 0, target: backdrop, currentTarget: backdrop });
  guard.up({ button: 0, target: backdrop, currentTarget: backdrop });
  assert.equal(dismissed, 1);
});

void test('timeline uses actual overlap and exact pixel boundaries for short and long records', () => {
  const origin = +new Date('2026-10-23T04:00:00');
  const start = +new Date('2026-10-23T04:55:00'),
    end = +new Date('2026-10-23T05:55:00');
  const hour = timelineRect(start, end, origin);
  assert.equal(hour.height, 72);
  assert.equal(hour.top + hour.height, ((end - origin) / 3600000) * 72);
  assert.equal(timelineRect(start, start + 5000, origin).height, 0.1);
  const layout = timelineLayout(
    [
      { id: 'a', start_at: 10, end_at: 11 },
      { id: 'b', start_at: 12, end_at: 13 },
    ],
    0,
    100,
    100,
  );
  assert.equal(layout[0]?.lanes, 1);
  assert.equal(layout[1]?.lanes, 1);
});
