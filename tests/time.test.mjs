import { summarize, timelineLayout } from '../src/entities/activity/lib/statistics.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayBounds, localDate, periodDays, shiftDate, unionDuration } from '../src/shared/lib/date.js';

test('union merges nested, adjacent and overlapping intervals', () => {
  assert.equal(
    unionDuration([
      [5, 10],
      [1, 7],
      [3, 4],
      [10, 15],
      [25, 30],
      [4, 4],
    ]),
    19,
  );
  assert.equal(unionDuration([]), 0);
});

test('parallel work counts once overall and independently per category', () => {
  const categories = [
    { id: 'code', is_work: true },
    { id: 'study', is_work: true },
    { id: 'video', is_work: false },
  ];
  const sessions = [
    { category_id: 'code', start_at: 10, end_at: 30 },
    { category_id: 'study', start_at: 20, end_at: 40 },
    { category_id: 'video', start_at: 10, end_at: 50 },
  ];
  const stats = summarize(sessions, categories, 0, 100, 100);
  assert.equal(stats.total, 40);
  assert.equal(stats.work, 30);
  assert.deepEqual(
    stats.byCategory.map((c) => c.duration),
    [20, 20, 40],
  );
});

test('sessions crossing midnight are clipped; active sessions stop at now', () => {
  const stats = summarize(
    [
      { category_id: 'a', start_at: 10, end_at: 80 },
      { category_id: 'a', start_at: 90, end_at: null },
    ],
    [{ id: 'a', is_work: true }],
    50,
    100,
    95,
  );
  assert.equal(stats.total, 35);
  assert.equal(stats.work, 35);
  assert.equal(summarize([{ category_id: 'a', start_at: 200, end_at: 300 }], [], 0, 100, 100).total, 0);
});

test('calendar uses local days, Monday weeks, leap years and month boundaries', () => {
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(periodDays('2024-02-20', 'month').length, 29);
  assert.deepEqual(periodDays('2026-10-23', 'week'), [
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
  const [a, b] = dayBounds('2026-10-23');
  assert.equal(localDate(a), '2026-10-23');
  assert.equal(localDate(b), '2026-10-24');
});

test('timeline allocates lanes per overlap cluster and clips day boundaries', () => {
  const layout = timelineLayout(
    [
      { id: 'a', start_at: 0, end_at: 30 },
      { id: 'b', start_at: 10, end_at: 20 },
      { id: 'c', start_at: 20, end_at: 40 },
      { id: 'd', start_at: 60, end_at: 100 },
    ],
    5,
    90,
    90,
  );
  assert.equal(layout.find((x) => x.id === 'a').start, 5);
  assert.equal(layout.find((x) => x.id === 'd').end, 90);
  assert.equal(layout.find((x) => x.id === 'a').lanes, 2);
  assert.equal(layout.find((x) => x.id === 'b').lane, layout.find((x) => x.id === 'c').lane);
  assert.equal(layout.find((x) => x.id === 'd').lanes, 1);
});
