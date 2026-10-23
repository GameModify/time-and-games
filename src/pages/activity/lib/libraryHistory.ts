import type { Game } from '../../../shared/api/contracts.ts';
import type { Media } from '../../../shared/api/mediaContracts.ts';
import { gameMinutes } from '../../../entities/game/index.ts';

export type HistoryKind = 'game' | 'movie' | 'series';
export interface LibraryCompletion {
  id: string;
  kind: HistoryKind;
  name: string;
  poster: string;
  date: string | null;
  minutes: number;
}
export function librarySummary(games: Game[], media: Media[]) {
  const rows: LibraryCompletion[] = [
    ...games.filter((g) => g.status === 'completed').map(gameCompletion),
    ...media.filter((m) => m.status === 'completed').map(mediaCompletion),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.name.localeCompare(b.name, 'ru'));
  return {
    rows,
    totals: (['game', 'movie', 'series'] as const).map((kind) =>
      completionTotal(rows, kind, libraryMinutes(games, media, kind)),
    ),
  };
}
function gameCompletion(game: Game): LibraryCompletion {
  return {
    id: game.id,
    kind: 'game',
    name: game.name,
    poster: game.poster,
    date: game.completed_at,
    minutes: gameMinutes(game),
  };
}
function mediaCompletion(media: Media): LibraryCompletion {
  return {
    id: media.id,
    kind: media.kind,
    name: media.name,
    poster: media.poster,
    date: media.completed_at,
    minutes: media.watched_minutes,
  };
}
function libraryMinutes(games: Game[], media: Media[], kind: HistoryKind) {
  return kind === 'game'
    ? games.reduce((sum, g) => sum + gameMinutes(g), 0)
    : media.filter((m) => m.kind === kind).reduce((sum, m) => sum + m.watched_minutes, 0);
}
function completionTotal(rows: LibraryCompletion[], kind: HistoryKind, minutes: number) {
  return {
    kind,
    completed: rows.filter((row) => row.kind === kind).length,
    completedMinutes: rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.minutes, 0),
    minutes,
  };
}
export function completionMonths(rows: LibraryCompletion[], year: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const items = rows.filter((row) => row.date?.startsWith(key));
    return {
      key,
      items,
      counts: (['game', 'movie', 'series'] as const).map((kind) => ({
        kind,
        count: items.filter((item) => item.kind === kind).length,
      })),
    };
  });
}
