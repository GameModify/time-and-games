import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityTracksInRange } from '../src/entities/activity/index.ts';
import { sortTimelineItems } from '../src/pages/activity/model/itemSorting.ts';
import type { Session } from '../src/shared/api/contracts.ts';
const rows: Session[] = [
  {
    id: 'long',
    category_id: 'web',
    game_id: null,
    title: 'Alpha',
    note: '',
    start_at: 0,
    end_at: 80,
    created_at: 0,
  },
  {
    id: 'recent',
    category_id: 'web',
    game_id: null,
    title: 'Zulu',
    note: '',
    start_at: 90,
    end_at: 100,
    created_at: 0,
  },
];
void test('recent visits and duration orders remain distinct and never mutate the timeline source', () => {
  const tracks = activityTracksInRange(rows, { from: 0, to: 100 }, 100);
  assert.equal(sortTimelineItems(tracks, 'recent')[0]?.id, 'recent:web');
  assert.equal(sortTimelineItems(tracks, 'oldest')[0]?.id, 'long:web');
  assert.equal(sortTimelineItems(tracks, 'duration-desc')[0]?.id, 'long:web');
  assert.equal(sortTimelineItems(tracks, 'duration-asc')[0]?.id, 'recent:web');
  assert.equal(sortTimelineItems(tracks, 'name')[0]?.id, 'long:web');
  assert.equal(tracks[0]?.id, 'long:web');
});
void test('duration sorting uses the visible period rather than the full historical session', () => {
  const tracks = activityTracksInRange(rows, { from: 75, to: 100 }, 100);
  assert.equal(sortTimelineItems(tracks, 'duration-desc')[0]?.id, 'recent:web');
});

void test('last visit means the latest entry, even if another session remains open longer', () => {
  const [old, recent] = rows;
  assert.ok(old && recent);
  const sessions = [
    { ...old, end_at: 300 },
    { ...recent, end_at: 200 },
  ];
  const tracks = activityTracksInRange(sessions, { from: 0, to: 400 }, 400);
  assert.equal(sortTimelineItems(tracks, 'recent')[0]?.id, 'recent:web');
});
