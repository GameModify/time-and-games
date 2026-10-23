import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMedia, nextEpisode, updateMediaProgress } from '../src/entities/media/index.ts';
import { mapCatalogDetails, mapCatalogResults, createCatalogClient } from '../server/media-catalog.ts';
import { personalRatingSchema } from '../src/shared/api/mediaContracts.ts';
import type { Media } from '../src/shared/api/mediaContracts.ts';
const series: Media = {
  ...emptyMedia(),
  id: 'series',
  created_at: 1,
  name: 'Series',
  kind: 'series',
  status: 'watching',
  runtime_minutes: 40,
  total_episodes: 3,
  episodes: [
    { season: 1, number: 1, name: 'One', runtime_minutes: 45, released: '2020-01-01T00:00:00Z' },
    { season: 1, number: 2, name: 'Two', runtime_minutes: null, released: '2020-01-02T00:00:00Z' },
    { season: 2, number: 1, name: 'Three', runtime_minutes: 50, released: '2020-02-01T00:00:00Z' },
  ],
};
void test('series progress crosses seasons, estimates duration and preserves manual time', () => {
  const one = updateMediaProgress(series, nextEpisode(series));
  assert.equal(one.current_episode, 1);
  assert.equal(one.watched_minutes, 45);
  const two = updateMediaProgress(one, nextEpisode(one));
  assert.equal(two.watched_minutes, 85);
  const three = updateMediaProgress(two, nextEpisode(two));
  assert.equal(three.current_season, 2);
  assert.equal(three.current_episode, 1);
  assert.equal(three.watched_episodes, 3);
  assert.equal(three.status, 'completed');
  assert.equal(three.watched_minutes, 135);
  assert.throws(() => nextEpisode(three));
  const manual = updateMediaProgress(one, { time_mode: 'manual', watched_minutes: 200 });
  assert.equal(updateMediaProgress(manual, nextEpisode(manual)).watched_minutes, 200);
  const seasonStart = updateMediaProgress(series, { current_season: 2, current_episode: 0 });
  assert.equal(seasonStart.watched_episodes, 2);
  assert.equal(seasonStart.watched_minutes, 85);
});
const futureSeries: Media = {
  ...series,
  episodes: [
    {
      ...series.episodes[0],
      season: 1,
      number: 1,
      name: 'Future',
      runtime_minutes: 50,
      released: '2999-01-01T00:00:00Z',
    },
  ],
};
void test('future, missing and duplicate episodes do not silently change progress', () => {
  assert.throws(() => nextEpisode(futureSeries));
  assert.throws(() => updateMediaProgress(series, { current_season: 1, current_episode: 999 }));
  const episode = series.episodes[0];
  assert.ok(episode);
  assert.throws(() => updateMediaProgress(series, { episodes: [episode, episode] }));
  const unknown = { ...series, episodes: [], total_episodes: null, runtime_minutes: null };
  assert.equal(updateMediaProgress(unknown, nextEpisode(unknown)).watched_minutes, 0);
});
void test('personal ratings accept half stars and reject unsupported fractions', () => {
  for (const rating of [null, 0.5, 1, 8.5, 9.5, 10])
    assert.equal(personalRatingSchema.safeParse(rating).success, true);
  for (const rating of [0, 0.25, 8.2, 10.5, '8.5'])
    assert.equal(personalRatingSchema.safeParse(rating).success, false);
});
const searchPayload = {
  metas: [
    {
      id: 'tt1375666',
      name: 'Inception',
      releaseInfo: '2010',
      poster: 'https://example.com/poster.jpg',
    },
    { id: 'bad', name: 'Invalid' },
  ],
};
const detailsPayload = {
  meta: {
    id: 'tt0903747',
    name: 'Series',
    imdbRating: '9.5',
    runtime: '49 min',
    year: '2008–2013',
    videos: [
      { season: 0, episode: 1, name: 'Special' },
      { season: 1, episode: 1, name: 'Pilot', released: '2008-01-01T00:00:00Z' },
    ],
  },
};
void test('catalog mapping labels IMDb data and tolerates absent optional metadata', () => {
  const results = mapCatalogResults(searchPayload, 'movie');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.imdb_id, 'tt1375666');
  const details = mapCatalogDetails(detailsPayload, 'series');
  assert.equal(details.imdb_rating, 9.5);
  assert.equal(details.runtime_minutes, 49);
  assert.equal(details.episodes.length, 1);
  assert.equal(details.year, 2008);
  assert.equal(details.source, 'cinemeta');
  const missing = mapCatalogDetails({ meta: { id: 'tt1375666', name: 'Movie' } }, 'movie');
  assert.equal(missing.imdb_rating, null);
  assert.equal(missing.runtime_minutes, null);
  assert.deepEqual(missing.episodes, []);
});
void test('catalog requests cache repeated lookups and reject invalid title IDs', async () => {
  let requests = 0;
  const client = createCatalogClient(() => {
    requests++;
    return Promise.resolve(
      Response.json({ meta: { id: 'tt1375666', name: 'Movie' }, results: { bindings: [] } }),
    );
  });
  await client.details('tt1375666', 'movie');
  await client.details('tt1375666', 'movie');
  assert.equal(requests, 2);
  await assert.rejects(() => client.details('../bad', 'movie'));
  assert.equal(requests, 2);
});
