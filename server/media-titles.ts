import { z } from 'zod';

const responseSchema = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        imdb: z.object({ value: z.string().regex(/^tt\d{5,12}$/) }),
        label: z.object({ value: z.string().trim().min(1).max(160), 'xml:lang': z.literal('ru') }),
      }),
    ),
  }),
});

type TitleRows = z.infer<typeof responseSchema>['results']['bindings'];
function lookupUrl(ids: string[]): URL {
  const query = `SELECT ?imdb ?label WHERE { VALUES ?imdb { ${ids.map((id) => '"' + id + '"').join(' ')} } ?item wdt:P345 ?imdb; rdfs:label ?label. FILTER(LANG(?label) = "ru") }`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);
  return url;
}
class TitleLocalizerContext {
  fetcher: typeof fetch;
  constructor(fetcher: typeof fetch) {
    this.fetcher = fetcher;
  }
}
class TitleLocalizer extends TitleLocalizerContext {
  cache = new Map<string, { title: string | undefined; expires: number }>();
  pending = new Map<string, Promise<void>>();
  retryAfter = 0;
  fetchTitles = async (ids: string[]): Promise<TitleRows> => {
    const response = await this.fetcher(lookupUrl(ids), {
      signal: AbortSignal.timeout(2500),
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'TimeAndGames/0.1 (https://github.com/GameModify/time-and-games)',
      },
    });
    if (!response.ok) throw new Error('Title lookup unavailable');
    return responseSchema.parse(await response.json()).results.bindings;
  };
  cacheTitles = (ids: string[], rows: TitleRows) => {
    for (const id of ids) {
      if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value ?? '');
      this.cache.set(id, {
        title: rows.find((row) => row.imdb.value === id)?.label.value,
        expires: Date.now() + 86400000,
      });
    }
  };
  request = async (ids: string[]) => {
    try {
      this.cacheTitles(ids, await this.fetchTitles(ids));
    } catch {
      this.retryAfter = Date.now() + 30000;
    }
  };
  lookup = async (ids: string[]) => {
    const valid = [...new Set(ids.filter((id) => /^tt\d{5,12}$/.test(id)))].slice(0, 24);
    const missing = valid.filter((id) => (this.cache.get(id)?.expires ?? 0) <= Date.now());
    if (missing.length && Date.now() >= this.retryAfter) {
      const key = [...missing].sort().join(',');
      let task = this.pending.get(key);
      if (!task) {
        task = this.request(missing).finally(() => this.pending.delete(key));
        this.pending.set(key, task);
      }
      await task;
    }
    return new Map(valid.map((id) => [id, this.cache.get(id)?.title]));
  };
}
export function createTitleLocalizer(fetcher: typeof fetch = fetch) {
  return new TitleLocalizer(fetcher).lookup;
}
