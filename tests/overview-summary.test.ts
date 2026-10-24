import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewRange } from '../src/features/workspace/model/overviewRange.ts';
import { sortedLanes } from '../src/pages/activity/model/timelineSummary.ts';
import { activityTracksInRange, categoryLanes, summarize } from '../src/entities/activity/index.ts';
import { start, end, minute, row, categories } from './timeline-fixture.ts';
const now = start + 6 * minute;
const source = [
  row('game-yesterday', -180, -60, { category_id: 'games' }),
  row('work-yesterday', -90, -30, { category_id: 'work' }),
  row('ongoing-video', -30, null),
];
const categoryList = categories.map((item) => ({ ...item, is_work: item.id === 'work' }));
function summary(hours: 2 | 6 | 24 | null, rolling = true) {
  const range = overviewRange({ calendar: [start, end], hours, rolling, now });
  return summarize(source, categoryList, ...range, now);
}
void test('overview balance and work totals use the rolling range across midnight', () => {
  const short = summary(2);
  assert.equal(short.total, 120 * minute);
  assert.equal(short.work, 60 * minute);
  assert.equal(short.categoryTotal, 150 * minute);
  assert.equal(short.byCategory.find((item) => item.id === 'games')?.duration, 54 * minute);
  assert.equal(summary(6).total, 186 * minute);
  assert.equal(summary(24).total, 186 * minute);
  assert.equal(summary(null).total, 6 * minute);
  assert.equal(summary(24, false).total, 6 * minute);
});
void test('time sorting follows the selected range and never mutates source category order', () => {
  const [from, to] = overviewRange({ calendar: [start, end], hours: 2, rolling: true, now });
  const lanes = categoryLanes(activityTracksInRange(source, { from, to }, now), categoryList);
  const original = lanes.map((lane) => lane.id);
  assert.deepEqual(
    sortedLanes(lanes, 'desc').map((lane) => lane.id),
    ['work', 'games', 'video'],
  );
  assert.deepEqual(
    sortedLanes(lanes, 'asc').map((lane) => lane.id),
    ['video', 'games', 'work'],
  );
  assert.deepEqual(
    lanes.map((lane) => lane.id),
    original,
  );
});
void test('sorting before collapsing keeps the six largest categories visible', () => {
  const lanes = categoryLanes(
    activityTracksInRange(source, { from: start - 180 * minute, to: now }, now),
    categoryList,
  );
  const first = lanes[0];
  assert.ok(first);
  const many = Array.from({ length: 8 }, (_, i) => ({ ...first, id: String(i), elapsed: i }));
  assert.deepEqual(
    sortedLanes(many, 'desc')
      .slice(0, 6)
      .map((lane) => lane.elapsed),
    [7, 6, 5, 4, 3, 2],
  );
});
