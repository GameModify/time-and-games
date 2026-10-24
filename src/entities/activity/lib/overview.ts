import type { Category, Session } from '../../../shared/api/contracts.ts';
import { localDate, unionDuration } from '../../../shared/lib/date.ts';
import { summarizeTrack } from './tracks.ts';
import type { ActivityTrack, TrackRange } from './tracks.ts';
export interface CategoryLane {
  id: string;
  name: string;
  color: string;
  tracks: ActivityTrack[];
  bands: TrackRange[];
  elapsed: number;
}
export function activityBands(tracks: ActivityTrack[]): TrackRange[] {
  const spans = tracks.flatMap((track) => track.segments).toSorted((a, b) => a.start - b.start);
  const bands: TrackRange[] = [];
  for (const span of spans) {
    const last = bands.at(-1);
    if (last && span.start <= last.to) last.to = Math.max(last.to, span.end);
    else bands.push({ from: span.start, to: span.end });
  }
  return bands;
}
function categoryLane(id: string, tracks: ActivityTrack[], category?: Category): CategoryLane {
  const bands = activityBands(tracks);
  return {
    id,
    name: category?.name ?? 'Без категории',
    color: category?.color ?? 'var(--muted)',
    tracks,
    bands,
    elapsed: unionDuration(bands.map((band) => [band.from, band.to])),
  };
}
export function categoryLanes(tracks: ActivityTrack[], categories: Category[]): CategoryLane[] {
  const catalog = new Map(categories.map((category) => [category.id, category]));
  const groups = new Map<string, ActivityTrack[]>();
  for (const track of tracks) {
    const rows = groups.get(track.category) ?? [];
    rows.push(track);
    groups.set(track.category, rows);
  }
  const ordered = [...categories.map((category) => category.id), ...groups.keys()];
  return [...new Set(ordered)].flatMap((id) => {
    const rows = groups.get(id);
    return rows ? [categoryLane(id, rows, catalog.get(id))] : [];
  });
}
function contentIdentity(session: Session): string {
  const context = session.tracking_context;
  if (session.game_id) return 'game:' + session.game_id;
  if (context?.media_id) return 'video:' + context.media_id;
  if (context?.project) return 'project:' + context.project;
  if (context?.website) return 'website:' + context.website;
  return 'title:' + session.title;
}
function contentTitle(session: Session): string {
  const context = session.tracking_context;
  if (session.game_id || context?.media_id) return session.title;
  return context?.project || context?.website || session.title;
}
export function timelineItems(tracks: ActivityTrack[]): ActivityTrack[] {
  const groups = new Map<string, ActivityTrack[]>();
  for (const track of tracks) {
    const first = track.segments[0]?.session;
    if (!first) continue;
    const id = track.category + ':' + contentIdentity(first);
    const rows = groups.get(id) ?? [];
    rows.push(track);
    groups.set(id, rows);
  }
  return [...groups]
    .map(([id, rows]) => combineItem(id, rows))
    .sort((a, b) => b.end - a.end || a.id.localeCompare(b.id));
}
function combineItem(id: string, tracks: ActivityTrack[]): ActivityTrack {
  const item = summarizeTrack(
    id,
    tracks.flatMap((track) => track.segments),
  );
  const first = item.segments[0]?.session;
  return { ...item, title: (first && contentTitle(first)) || tracks[0]?.title || item.title };
}

function liveSession(session: Session, now: number): boolean {
  if (session.start_at > now) return false;
  return (
    session.end_at === null ||
    Boolean(session.tracking_live && session.end_at >= now - 15000 && session.end_at <= now + 5000)
  );
}
export function currentActivities(tracks: ActivityTrack[], date: string, now: number): ActivityTrack[] {
  if (localDate(now) !== date) return [];
  return timelineItems(tracks).filter((track) =>
    track.segments.some((segment) => liveSession(segment.session, now)),
  );
}

export function tracksInRange(tracks: ActivityTrack[], range: TrackRange): ActivityTrack[] {
  return tracks.flatMap((track) => {
    const segments = track.segments.flatMap((segment) => {
      const start = Math.max(segment.start, range.from);
      const end = Math.min(segment.end, range.to);
      return end > start ? [{ ...segment, start, end }] : [];
    });
    return segments.length ? [{ ...summarizeTrack(track.id, segments), title: track.title }] : [];
  });
}
