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
  activityTracksInRange,
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
  assert.deepEqual(shiftedTrackRange(range, day, 100), range);
  const first = shiftedTrackRange(range, day, -100);
  assert.equal(first.from, start);
  assert.equal(first.to - first.from, range.to - range.from);
});
void test('recent mode ends at now and includes yesterday immediately after midnight', () => {
  const now = start + 6 * minute;
  assert.deepEqual(recentTrackRange(now, 2), { from: start - 114 * minute, to: now });
  assert.deepEqual(recentTrackRange(start, 2), { from: start - 120 * minute, to: start });
});
void test('all recent presets keep exact elapsed hours across date and month boundaries', () => {
  const now = new Date('2026-11-01T00:06:00').getTime();
  for (const hours of [2, 6, 8, 12, 24] as const) {
    const range = recentTrackRange(now, hours);
    assert.equal(range.to, now);
    assert.equal(range.to - range.from, hours * 3600000);
    assert.ok(range.from < new Date('2026-11-01T00:00:00').getTime());
  }
});
void test('focusing a short record preserves its original bounds and adds context within the day', () => {
  const focused = focusedTrackRange({ from: start, to: start + 5000 }, day);
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

void test('rolling tracks retain yesterday and clip both ends without changing source records', () => {
  const now = start + 6 * minute;
  const range = recentTrackRange(now, 2);
  const yesterday = row('yesterday', -180, -60);
  const ongoing = row('ongoing', -30, null);
  const tracks = activityTracksInRange([yesterday, ongoing, row('old', -200, -150)], range, now);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0]?.start, range.from);
  assert.equal(tracks[0].elapsed, 54 * minute);
  assert.equal(tracks[1]?.end, now);
  assert.equal(tracks[1].elapsed, 36 * minute);
  assert.equal(tracks[0].segments[0]?.session, yesterday);
  assert.equal(yesterday.start_at, start - 180 * minute);
});
void test('rolling zoom and focus can cross midnight while remaining inside the selected period', () => {
  const now = start + 6 * minute;
  const bounds = recentTrackRange(now, 24);
  const selected = selectedTrackRange(bounds, 0.9, 1);
  const previous = shiftedTrackRange(selected, bounds, -1);
  assert.ok(previous.from < start);
  assert.equal(shiftedTrackRange(selected, bounds, -100).from, bounds.from);
  assert.equal(focusedTrackRange({ from: start - minute, to: now }, bounds).to, now);
});
