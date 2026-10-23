import type { Media, MediaInput, Episode } from '../../../shared/api/mediaContracts.ts';
import { localDate } from '../../../shared/lib/date.ts';
export const mediaStatuses = {
  planned: 'К просмотру',
  watching: 'Смотрю',
  completed: 'Просмотрено',
  paused: 'На паузе',
  dropped: 'Заброшено',
} as const;
export function orderedEpisodes(episodes: Episode[]) {
  return [...episodes].sort((a, b) => a.season - b.season || a.number - b.number);
}
export function nextEpisode(item: Media, now = Date.now()): MediaInput {
  if (item.kind !== 'series') throw new Error('Серии есть только у сериалов');
  if (item.total_episodes !== null && item.watched_episodes >= item.total_episodes)
    throw new Error('Все известные серии уже просмотрены');
  const episodes = orderedEpisodes(item.episodes);
  const next = episodes.find(
    (e) =>
      e.season > item.current_season ||
      (e.season === item.current_season && e.number > item.current_episode),
  );
  if (episodes.length && !next) throw new Error('Новых серий в каталоге пока нет');
  if (next?.released && Date.parse(next.released) > now) throw new Error('Следующая серия ещё не вышла');
  return {
    current_season: next?.season ?? item.current_season,
    current_episode: next?.number ?? item.current_episode + 1,
    watched_episodes: item.watched_episodes + 1,
    status: 'watching',
  };
}
export function updateMediaProgress(item: Media, patch: MediaInput): Media {
  const next = { ...item, ...patch };
  if (next.kind === 'movie') updateMovieProgress(next);
  else updateSeriesProgress(next, patch);
  return updateProgressDates(item, next);
}
function updateProgressDates(item: Media, next: Media) {
  if (next.status !== item.status) {
    if (next.status === 'watching' && !next.started_at && !next.completed_at)
      next.started_at = localDate();
    if (next.status === 'completed' && !next.completed_at) next.completed_at = localDate();
  }
  if (next.started_at && next.completed_at && next.completed_at < next.started_at)
    throw new Error('Дата окончания просмотра должна быть не раньше начала');
  return next;
}
function updateMovieProgress(next: Media) {
  next.episodes = [];
  next.total_episodes = null;
  next.watched_episodes = 0;
  next.current_season = 1;
  next.current_episode = 0;
  if (next.time_mode === 'estimated')
    next.watched_minutes = next.status === 'completed' ? (next.runtime_minutes ?? 0) : 0;
}
function watchedPosition(next: Media) {
  const position = orderedEpisodes(next.episodes).findIndex(
    (e) => e.season === next.current_season && e.number === next.current_episode,
  );
  if (next.current_episode > 0 && position < 0) throw new Error('Такой серии нет в выбранном сезоне');
  return next.current_episode === 0
    ? next.episodes.filter((e) => e.season < next.current_season).length
    : position + 1;
}
function updateSeriesCatalog(next: Media, patch: MediaInput) {
  if (next.episodes.length) {
    const unique = new Set(next.episodes.map((e) => `${e.season}:${e.number}`));
    if (unique.size !== next.episodes.length) throw new Error('В списке есть повторяющиеся серии');
    next.total_episodes = next.episodes.length;
    if ('current_season' in patch || 'current_episode' in patch) {
      next.watched_episodes = watchedPosition(next);
    }
  }
  if (next.total_episodes !== null && next.watched_episodes > next.total_episodes)
    throw new Error('Просмотренных серий больше, чем всего серий');
}
function estimateSeriesTime(next: Media) {
  if (next.time_mode === 'estimated') {
    const episodes = orderedEpisodes(next.episodes).slice(0, next.watched_episodes);
    next.watched_minutes = episodes.length
      ? episodes.reduce((sum, e) => sum + (e.runtime_minutes ?? next.runtime_minutes ?? 0), 0)
      : next.watched_episodes * (next.runtime_minutes ?? 0);
  }
}
function updateSeriesProgress(next: Media, patch: MediaInput) {
  updateSeriesCatalog(next, patch);
  estimateSeriesTime(next);
  if (
    next.watched_episodes > 0 &&
    next.total_episodes !== null &&
    next.watched_episodes === next.total_episodes &&
    next.status === 'watching'
  )
    next.status = 'completed';
}
const emptyMediaDefaults: Omit<Media, 'id' | 'created_at'> = {
  name: '',
  kind: 'movie',
  status: 'planned',
  favorite: false,
  started_at: null,
  completed_at: null,
  poster: '',
  description: '',
  review: '',
  rating: null,
  year: null,
  imdb_id: null,
  imdb_rating: null,
  runtime_minutes: null,
  total_episodes: null,
  episodes: [],
  current_season: 1,
  current_episode: 0,
  watched_episodes: 0,
  watched_minutes: 0,
  time_mode: 'estimated',
  source: 'manual',
  metadata_updated_at: null,
};
export function emptyMedia(): Omit<Media, 'id' | 'created_at'> {
  return structuredClone(emptyMediaDefaults);
}
