import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tracksInRange,
  recentTrackRange,
  selectedTrackRange,
  focusedTrackRange,
  zoomTrackRange,
  shiftedTrackRange,
  overviewTicks,
  activityTracks,
} from '../src/entities/activity/index.ts';
import { date, start, end, minute, row } from './timeline-fixture.ts';
const day = { from: start, to: end };
void test('dragging in either direction selects the same exact interval and clamps outside the plot', () => {
  const forward = selectedTrackRange(day, 0.25, 0.5);
  assert.deepEqual(forward, selectedTrackRange(day, 0.5, 0.25));
  assert.equal(forward.from, start + (end - start) / 4);
  assert.equal(forward.to, start + (end - start) / 2);
  assert.deepEqual(selectedTrackRange(day, -1, 2), day);
  assert.deepEqual(selectedTrackRange(day, 1, 1), { from: end - minute, to: end });
});
void test('zoom has a one-minute floor and panning never escapes the selected day', () => {
  const range = zoomTrackRange(day, end - minute);
  assert.equal(range.to, end);
  assert.equal(range.to - range.from, (end - start) / 2);
  const minimal = { from: start, to: start + minute };
  assert.deepEqual(zoomTrackRange(minimal, start), minimal);
  assert.deepEqual(shiftedTrackRange(range, date, 100), range);
  const first = shiftedTrackRange(range, date, -100);
  assert.equal(first.from, start);
  assert.equal(first.to - first.from, range.to - range.from);
});
void test('recent mode follows the current date and the last activity on historical dates', () => {
  const tracks = activityTracks([row('a', 180, 240)], date, end);
  const current = recentTrackRange(date, start + 600 * minute, tracks);
  assert.deepEqual(current, { from: start + 480 * minute, to: start + 600 * minute });
  assert.deepEqual(recentTrackRange(date, end + minute, tracks), {
    from: start + 120 * minute,
    to: start + 240 * minute,
  });
});
void test('focusing a short record preserves its original bounds and adds context within the day', () => {
  const focused = focusedTrackRange({ from: start, to: start + 5000 }, date);
  assert.equal(focused.from, start);
  assert.equal(focused.to, start + 65000);
});
void test('overview ticks include both edges without dense hourly labels or duplicate endpoints', () => {
  const ticks = overviewTicks(day);
  assert.equal(ticks[0], start);
  assert.equal(ticks.at(-1), end);
  assert.ok(ticks.length <= 7);
  assert.equal(ticks.length, new Set(ticks).size);
  const close = overviewTicks({ from: start + 10000, to: start + 5 * minute + 10000 });
  assert.ok(close.length <= 7);
});

void test('zoomed categories exclude unrelated history and clip totals without modifying source records', () => {
  const source = row('a', 0, 60);
  const tracks = activityTracks([source, row('b', 100, 120)], date, end);
  const clipped = tracksInRange(tracks, { from: start + 30 * minute, to: start + 45 * minute });
  assert.equal(clipped.length, 1);
  assert.equal(clipped[0]?.elapsed, 15 * minute);
  assert.equal(clipped[0].segments[0]?.session, source);
  assert.equal(source.start_at, start);
  assert.equal(source.end_at, start + 60 * minute);
});
