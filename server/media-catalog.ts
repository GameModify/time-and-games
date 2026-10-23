import type {
  CatalogResult,
  MediaKind,
  CatalogDetails,
  Episode,
} from '../src/shared/api/mediaContracts.ts';
import { z } from 'zod';
import { createTitleLocalizer } from './media-titles.ts';
const rawMeta = z.object({
  id: z.string().optional(),
  imdb_id: z.string().optional(),
  name: z.string(),
  type: z.enum(['movie', 'series']).optional(),
  poster: z.string().nullish(),
  releaseInfo: z.string().optional(),
  year: z.union([z.string(), z.number()]).optional(),
  imdbRating: z.union([z.string(), z.number()]).nullish(),
  description: z.string().nullish(),
  runtime: z.string().nullish(),
  videos: z
    .array(
      z.object({
        season: z.number().optional(),
        episode: z.number().optional(),
        number: z.number().optional(),
        name: z.string().optional(),
        title: z.string().optional(),
        released: z.string().nullish(),
        runtime: z.string().nullish(),
      }),
    )
    .optional(),
});
function httpsUrl(value: string | null | undefined) {
  if (!value) return '';
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}
function minutes(value: string | null | undefined) {
  const match = value?.match(/(\d+)\s*(?:min|m)\b/i);
  return match ? Number(match[1]) : null;
}
function year(value: string | number | undefined) {
  const match = String(value ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}
export function mapCatalogResults(data: unknown, kind: MediaKind): CatalogResult[] {
  const result = z.object({ metas: z.array(z.unknown()).default([]) }).parse(data);
  return result.metas.flatMap((value) => catalogResult(value, kind)).slice(0, 24);
}
function catalogResult(value: unknown, kind: MediaKind): CatalogResult[] {
  const parsed = rawMeta.safeParse(value);
  if (!parsed.success) return [];
  const meta = parsed.data,
    id = meta.imdb_id ?? meta.id;
  if (!id || !/^tt\d{5,12}$/.test(id)) return [];
  return [
    {
      imdb_id: id,
      name: meta.name,
      kind,
      poster: httpsUrl(meta.poster),
      year: year(meta.releaseInfo ?? meta.year),
    },
  ];
}
export function mapCatalogDetails(data: unknown, kind: MediaKind): CatalogDetails {
  const m = z.object({ meta: rawMeta }).parse(data).meta;
  const imdbId = m.imdb_id ?? m.id;
  if (!imdbId || !/^tt\d{5,12}$/.test(imdbId)) throw new Error('В каталоге нет IMDb ID');
  const episodes = kind === 'series' ? catalogEpisodes(m.videos ?? []) : [];
  return {
    name: m.name.slice(0, 160),
    kind,
    poster: httpsUrl(m.poster),
    description: (m.description ?? '').slice(0, 10000),
    year: year(m.releaseInfo ?? m.year),
    imdb_id: imdbId,
    imdb_rating: catalogRating(m.imdbRating),
    runtime_minutes: minutes(m.runtime),
    total_episodes: kind === 'series' && episodes.length ? episodes.length : null,
    episodes,
    source: 'cinemeta',
    metadata_updated_at: Date.now(),
  };
}
type CatalogMeta = z.infer<typeof rawMeta>;
function catalogEpisodes(videos: NonNullable<CatalogMeta['videos']>): Episode[] {
  return videos.flatMap((v) => {
    const number = v.episode ?? v.number;
    if (!v.season || v.season < 1 || !number || number < 1) return [];
    return [
      {
        season: v.season,
        number,
        name: v.name ?? v.title ?? `Серия ${number}`,
        runtime_minutes: minutes(v.runtime),
        released: v.released && Number.isFinite(Date.parse(v.released)) ? v.released : null,
      },
    ];
  });
}
function catalogRating(rating: CatalogMeta['imdbRating']): number | null {
  const value = Number(rating);
  return rating != null && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
}
class CatalogClientContext {
  fetcher: typeof fetch;
  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
  }
}
class CatalogClient extends CatalogClientContext {
  localizedTitles = createTitleLocalizer(this.fetcher);
  cache = new Map<
    string,
    {
      expires: number;
      data: unknown;
    }
  >();
  request = async (path: string) => {
    const hit = this.cache.get(path);
    if (hit && hit.expires > Date.now()) return hit.data;
    const response = await this.fetcher('https://v3-cinemeta.strem.io' + path, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'TimeAndGames/0.1' },
    });
    if (!response.ok) throw new Error('Кинокаталог временно недоступен');
    const data: unknown = await response.json();
    if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value ?? '');
    this.cache.set(path, { expires: Date.now() + 3600000, data });
    return data;
  };
  search = async (query: string, kind: MediaKind) => {
    const results = mapCatalogResults(
      await this.request(`/catalog/${kind}/top/search=${encodeURIComponent(query)}.json`),
      kind,
    );
    const titles = await this.localizedTitles(results.map((result) => result.imdb_id));
    return results.map((result) => {
      const name = titles.get(result.imdb_id);
      return name && name !== result.name ? { ...result, name, original_name: result.name } : result;
    });
  };
  details = async (id: string, kind: MediaKind) => {
    if (!/^tt\d{5,12}$/.test(id)) throw new Error('Неверный IMDb ID');
    const details = mapCatalogDetails(await this.request(`/meta/${kind}/${id}.json`), kind);
    const titles = await this.localizedTitles([id]);
    return { ...details, name: titles.get(id) ?? details.name };
  };
  constructor(fetcher: typeof fetch = fetch) {
    super(fetcher);
  }
}
type CatalogClientView = Pick<CatalogClient, 'search' | 'details'>;
export function createCatalogClient(fetcher: typeof fetch = fetch): CatalogClientView {
  return new CatalogClient(fetcher);
}
