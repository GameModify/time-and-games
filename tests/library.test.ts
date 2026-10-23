import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { gameSchema } from '../src/shared/api/contracts.ts';
import type { Game } from '../src/shared/api/contracts.ts';
import { emptyMedia, updateMediaProgress } from '../src/entities/media/index.ts';
import { useGameLibrary } from '../src/pages/games/model/useGameLibrary.ts';
import { librarySummary, completionMonths } from '../src/pages/activity/lib/libraryHistory.ts';
import { localDate } from '../src/shared/lib/date.ts';
import { mediaSchema, mediaInputSchema } from '../src/shared/api/mediaContracts.ts';
function game(values: Partial<Game>) {
  return gameSchema.parse({
    id: 'game',
    name: 'Game',
    poster: '',
    steam_appid: null,
    status: 'playing',
    rating: null,
    review: '',
    started_at: localDate(),
    completed_at: null,
    playtime_minutes: 10,
    created_at: 1,
    ...values,
  });
}
function assertFavoriteFilter(model: ReturnType<typeof useGameLibrary>) {
  model.favoritesOnly.value = true;
  model.search.value = 'Missing';
  assert.equal(model.filteredGames.value.length, 0);
  model.search.value = '';
  assert.equal(model.filteredGames.value.length, 1);
  model.favoritesOnly.value = false;
}
function gameFilterFixture() {
  return useGameLibrary(
    ref([
      game({ id: 'playing', favorite: true }),
      game({ id: 'completed', status: 'completed', completed_at: localDate() }),
      game({ id: 'old', started_at: '2020-01-01' }),
    ]),
  );
}
void test('game date filters keep the selected status and use start dates while playing', () => {
  const model = gameFilterFixture();
  model.setStatus('playing');
  model.setPeriod('month');
  assert.equal(model.statusFilter.value, 'playing');
  assert.deepEqual(
    model.filteredGames.value.map((g) => g.id),
    ['playing'],
  );
  assert.equal(model.periodLabel.value, 'Когда начаты');
  assertFavoriteFilter(model);
  model.setStatus('completed');
  assert.equal(model.completionPeriod.value, 'month');
  assert.deepEqual(
    model.filteredGames.value.map((g) => g.id),
    ['completed'],
  );
});
const movie = {
  ...emptyMedia(),
  id: 'movie',
  created_at: 1,
  name: 'Movie',
  kind: 'movie' as const,
  status: 'completed' as const,
  completed_at: '2026-01-02',
  watched_minutes: 120,
};
const series = {
  ...movie,
  id: 'series',
  kind: 'series' as const,
  completed_at: null,
  watched_minutes: 300,
};

function historyFixture() {
  return librarySummary(
    [
      game({ status: 'completed', completed_at: '2026-01-31', total_minutes: 60 }),
      game({ id: 'playing', playtime_minutes: 15 }),
      game({ id: 'old', status: 'completed', completed_at: '2025-12-31', playtime_minutes: 20 }),
    ],
    [movie, series],
  );
}
void test('history separates libraries, counts completed items and keeps unknown dates out of months', () => {
  const result = historyFixture();
  assert.equal(result.rows.length, 4);
  assert.deepEqual(
    result.totals.map((t) => [t.completed, t.completedMinutes, t.minutes]),
    [
      [2, 80, 95],
      [1, 120, 120],
      [1, 300, 300],
    ],
  );
  const months = completionMonths(result.rows, '2026');
  assert.equal(months.length, 12);
  assert.equal(months[0]?.items.length, 2);
  assert.equal(months.at(-1)?.items.length, 0);
  assert.equal(completionMonths(result.rows, '2025').at(-1)?.items.length, 1);
});
function assertLegacyDefaults(completed: ReturnType<typeof updateMediaProgress>) {
  const { favorite, started_at, completed_at, ...legacy } = completed;
  assert.equal(favorite, true);
  assert.equal(started_at, null);
  assert.ok(completed_at);
  const parsed = mediaSchema.parse(legacy);
  assert.equal(parsed.completed_at, null);
  assert.equal(parsed.favorite, false);
}
void test('legacy media defaults, partial patches and completion dates preserve history', () => {
  assert.deepEqual(mediaInputSchema.parse({ review: 'Note' }), { review: 'Note' });
  const item = { ...emptyMedia(), id: 'movie', created_at: 1, name: 'Movie' };
  const completed = updateMediaProgress(item, {
    status: 'completed',
    favorite: true,
    runtime_minutes: 100,
  });
  assert.equal(completed.completed_at, localDate());
  const updated = updateMediaProgress(completed, mediaInputSchema.parse({ review: 'New' }));
  assert.equal(updated.favorite, true);
  assert.equal(updated.completed_at, completed.completed_at);
  assertLegacyDefaults(completed);
  const historical = updateMediaProgress(item, { status: 'completed', completed_at: '2020-01-01' });
  assert.equal(updateMediaProgress(historical, { status: 'watching' }).started_at, null);
  assert.throws(() =>
    updateMediaProgress(item, { started_at: '2026-10-02', completed_at: '2026-10-01' }),
  );
});
