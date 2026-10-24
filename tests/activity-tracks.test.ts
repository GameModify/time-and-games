import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from '../src/shared/api/contracts.ts';
import {
  activityTracks,
  trackRange,
  trackTicks,
  trackGeometry,
} from '../src/entities/activity/index.ts';
import { dayBounds } from '../src/shared/lib/date.ts';
import { gameApplicationSchema } from '../src/shared/api/trackingContracts.ts';
import { gameApplicationRules } from '../server/tracking/game-app.ts';
const date = '2026-10-23',
  [start, end] = dayBounds(date),
  minute = 60000;
function session(id: string, from: number, to: number | null, patch: Partial<Session> = {}): Session {
  return {
    id,
    start_at: start + from,
    end_at: to === null ? null : start + to,
    category_id: 'video',
    title: 'Example',
    game_id: null,
    note: '',
    created_at: start,
    ...patch,
  };
}
void test('dense interrupted viewing becomes one labelled track with exact gaps and original editable sessions', () => {
  const rows = Array.from({ length: 60 }, (_, index) =>
    session(String(index), index * minute, index * minute + 10000, { group_id: 'film' }),
  );
  const tracks = activityTracks(rows, date, end);
  assert.equal(tracks.length, 1);
  const track = tracks[0];
  assert.ok(track);
  assert.equal(track.segments.length, 60);
  assert.equal(track.elapsed, 600000);
  assert.equal(track.paused, 2950000);
  assert.equal(track.segments[0]?.session, rows[0]);
});
void test('parallel categories remain separate and overlapping segments do not double their own duration', () => {
  const rows = [
    session('a', 0, 20 * minute, { group_id: 'group' }),
    session('b', 10 * minute, 30 * minute, { group_id: 'group' }),
    session('c', 0, 30 * minute, { group_id: 'group', category_id: 'games' }),
  ];
  const tracks = activityTracks(rows, date, end);
  assert.equal(tracks.length, 2);
  assert.ok(tracks.every((track) => track.elapsed === 30 * minute));
});
void test('day clipping preserves edit identities, live limits and finished future intervals', () => {
  const crossing = session('before', -minute, minute);
  const rows = [
    crossing,
    session('active', 90 * minute, null),
    session('future', 120 * minute, 240 * minute),
  ];
  const tracks = activityTracks(rows, date, start + 120 * minute);
  const first = tracks.find((track) => track.id.startsWith('before:'));
  assert.equal(first?.start, start);
  assert.equal(first.segments[0]?.session.start_at, start - minute);
  assert.equal(tracks.find((track) => track.id.startsWith('active:'))?.elapsed, 30 * minute);
  assert.equal(tracks.find((track) => track.id.startsWith('future:'))?.elapsed, 120 * minute);
});
void test('overview tick labels remain sparse while detail geometry preserves five-second duration', () => {
  const range = { from: start, to: end };
  assert.ok(trackTicks(range).length <= 9);
  assert.equal(trackTicks(range).at(-1), end);
  assert.equal(trackTicks(range, true).length, 25);
  const row = session('short', 0, 5000);
  const rect = trackGeometry({ session: row, start, end: start + 5000 }, range);
  assert.equal(rect.left, 0);
  assert.ok(Math.abs(rect.width - (5000 / (end - start)) * 100) < 0.00001);
  const tracks = activityTracks([row], date, end);
  assert.equal(trackRange(tracks, date, false).to, start + 3 * 3600000);
  assert.deepEqual(trackRange([], date, true), range);
});
void test('confirmed game application rules are idempotent and reject process paths', () => {
  const input = gameApplicationSchema.parse({ app: 'Example.exe', title: 'Example' });
  const first = gameApplicationRules([], input);
  const second = gameApplicationRules(first, input);
  assert.equal(second.length, 1);
  assert.equal(second[0]?.id, first[0]?.id);
  assert.equal(second[0]?.activity, 'games');
  assert.equal(gameApplicationSchema.safeParse({ app: 'C:/game.exe', title: 'Game' }).success, false);
});
