import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityTracks,
  categoryLanes,
  timelineItems,
  currentActivities,
} from '../src/entities/activity/index.ts';
import { date, start, end, minute, row, categories } from './timeline-fixture.ts';
void test('one category lane contains a hundred videos while preserving exact ten-second gaps', () => {
  const rows = Array.from({ length: 100 }, (_, index) => row(String(index), index, index + 1 / 6));
  const lanes = categoryLanes(activityTracks(rows, date, end), categories);
  assert.equal(lanes.length, 1);
  assert.equal(lanes[0]?.bands.length, 100);
  assert.equal(lanes[0].elapsed, 1000000);
  assert.equal(lanes[0].bands[0]?.to, start + 10000);
  assert.equal(lanes[0].bands[1]?.from, start + minute);
});
void test('category lanes merge only touching or overlapping bands and keep catalog order', () => {
  const rows = [
    row('v1', 0, 20),
    row('v2', 10, 30),
    row('v3', 31, 32),
    row('g', 0, 30, { category_id: 'games' }),
  ];
  const lanes = categoryLanes(activityTracks(rows, date, end), categories);
  assert.deepEqual(
    lanes.map((lane) => lane.id),
    ['games', 'video'],
  );
  assert.equal(lanes[0]?.elapsed, 30 * minute);
  assert.equal(lanes[1]?.elapsed, 31 * minute);
  assert.equal(lanes[1].bands.length, 2);
  assert.equal(lanes[1].bands[0]?.to, start + 30 * minute);
});
void test('video identity groups repeated visits without combining different videos or categories', () => {
  const first = row('a', 0, 1, { tracking_context: { media_id: 'abcdefghijk' } });
  const rows = [
    first,
    row('b', 2, 3, { tracking_context: { media_id: 'abcdefghijk' } }),
    row('c', 4, 5, { tracking_context: { media_id: 'Abcdefghijk' } }),
  ];
  const items = timelineItems(activityTracks(rows, date, end));
  assert.equal(items.length, 2);
  const repeated = items.find((item) => item.segments.length === 2);
  assert.equal(repeated?.elapsed, 2 * minute);
  assert.equal(repeated.paused, minute);
  assert.equal(repeated.segments[0]?.session, first);
});
void test('project details combine documents but retain individual source records and notes', () => {
  const context = { project: 'Example project' };
  const rows = [
    row('a', 0, 1, {
      title: 'Document',
      note: 'Result',
      category_id: 'work',
      tracking_context: context,
    }),
    row('b', 2, 3, { title: 'Editor', category_id: 'work', tracking_context: context }),
  ];
  const items = timelineItems(activityTracks(rows, date, end));
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, 'Example project');
  assert.equal(items[0].segments[0]?.session.note, 'Result');
  assert.equal(items[0].segments[1]?.session.title, 'Editor');
});
void test('current activities include early-started games and fresh live snapshots but not paused or future records', () => {
  const now = start + 600 * minute;
  const rows = [
    row('g', 0, null, { category_id: 'games', title: 'Game' }),
    row('v', 590, 600, { tracking_live: true }),
    row('paused', 580, 590, { title: 'Paused' }),
    row('future', 610, 620, { title: 'Future' }),
  ];
  const tracks = activityTracks(rows, date, now);
  const current = currentActivities(tracks, date, now);
  assert.deepEqual(current.map((item) => item.title).sort(), ['Game', 'Video']);
  assert.equal(currentActivities(tracks, date, now + minute).length, 1);
  assert.equal(currentActivities(tracks, date, end + minute).length, 0);
});
void test('unknown categories stay visible and an empty date has no lanes', () => {
  const tracks = activityTracks([row('orphan', 0, 1, { category_id: 'unknown' })], date, end);
  assert.equal(categoryLanes(tracks, categories)[0]?.name, 'Без категории');
  assert.deepEqual(categoryLanes([], categories), []);
});

void test('game visits keep the catalog name when the optional record title is empty', () => {
  const source = row('a', 0, 10, { game_id: 'game', title: '' });
  const tracks = activityTracks([source], date, end).map((track) => ({
    ...track,
    title: 'Game from library',
  }));
  assert.equal(timelineItems(tracks)[0]?.title, 'Game from library');
});
