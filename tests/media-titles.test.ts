import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTitleLocalizer } from '../server/media-titles.ts';
import { createCatalogClient } from '../server/media-catalog.ts';
function requestUrl(input: Parameters<typeof fetch>[0]) {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

const translations = {
  results: {
    bindings: [
      { imdb: { value: 'tt1375666' }, label: { value: 'Начало', 'xml:lang': 'ru' } },
      { imdb: { value: 'tt0903747' }, label: { value: 'Во все тяжкие', 'xml:lang': 'ru' } },
    ],
  },
};

void test('Russian titles use exact IMDb matches, batch requests and cache missing translations', async () => {
  const urls: string[] = [];
  const lookup = createTitleLocalizer((input) => {
    urls.push(requestUrl(input));
    return Promise.resolve(Response.json(translations));
  });
  const ids = ['tt1375666', 'tt0903747', 'tt9999999'];
  const [one, two] = await Promise.all([lookup(ids), lookup(ids)]);
  assert.equal(one.get('tt1375666'), 'Начало');
  assert.equal(two.get('tt0903747'), 'Во все тяжкие');
  assert.equal(one.get('tt9999999'), undefined);
  await lookup(ids);
  await lookup(['invalid" } ?secret ?p ?o']);
  assert.equal(urls.length, 1);
  const url = new URL(urls[0] ?? '');
  assert.equal(url.hostname, 'query.wikidata.org');
  assert.match(url.searchParams.get('query') ?? '', /LANG\(\?label\) = "ru"/);
});

void test('catalog searches and selected cards retain identity and show the same Russian title', async () => {
  let translationRequests = 0;
  const client = createCatalogClient((input) => {
    if (requestUrl(input).includes('query.wikidata.org')) {
      translationRequests++;
      return Promise.resolve(Response.json(translations));
    }
    const movie = { id: 'tt1375666', name: 'Inception', poster: 'https://example.com/cover.jpg' };
    return Promise.resolve(Response.json({ metas: [movie], meta: movie }));
  });
  const results = await client.search('Начало', 'movie');
  const first = results[0];
  assert.ok(first);
  assert.equal(first.name, 'Начало');
  assert.equal(first.original_name, 'Inception');
  assert.equal(first.imdb_id, 'tt1375666');
  assert.equal((await client.details('tt1375666', 'movie')).name, 'Начало');
  assert.equal(translationRequests, 1);
});

void test('failed or malformed translations preserve the usable original catalog', async () => {
  for (const payload of [
    undefined,
    {
      results: {
        bindings: [{ imdb: { value: 'tt1375666' }, label: { value: 'Wrong', 'xml:lang': 'en' } }],
      },
    },
  ]) {
    const client = createCatalogClient((input) => {
      if (requestUrl(input).includes('query.wikidata.org')) {
        if (!payload) return Promise.reject(new Error('Offline'));
        return Promise.resolve(Response.json(payload));
      }
      return Promise.resolve(Response.json({ metas: [{ id: 'tt1375666', name: 'Inception' }] }));
    });
    const results = await client.search('Inception', 'movie');
    assert.equal(results[0]?.name, 'Inception');
  }
});
