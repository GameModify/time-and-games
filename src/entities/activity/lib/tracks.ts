import type { Session } from '../../../shared/api/contracts.ts';
import { dayBounds, unionDuration } from '../../../shared/lib/date.ts';
export interface TrackSegment {
  session: Session;
  start: number;
  end: number;
}
export interface ActivityTrack {
  id: string;
  category: string;
  title: string;
  segments: TrackSegment[];
  start: number;
  end: number;
  elapsed: number;
  paused: number;
}
export interface TrackRange {
  from: number;
  to: number;
}
function daySegments(sessions: Session[], range: TrackRange, now: number): TrackSegment[] {
  return sessions
    .map((session) => ({
      session,
      start: Math.max(session.start_at, range.from),
      end: Math.min(session.end_at ?? now, range.to),
    }))
    .filter((segment) => segment.end > segment.start);
}
export function summarizeTrack(id: string, segments: TrackSegment[]): ActivityTrack {
  const first = segments[0];
  if (!first) throw new Error('A timeline track needs at least one segment');
  const start = Math.min(...segments.map((segment) => segment.start));
  const end = Math.max(...segments.map((segment) => segment.end));
  const elapsed = unionDuration(segments.map((segment) => [segment.start, segment.end]));
  return {
    id,
    category: first.session.category_id,
    title: first.session.title,
    segments: segments.toSorted((a, b) => a.start - b.start),
    start,
    end,
    elapsed,
    paused: Math.max(0, end - start - elapsed),
  };
}
export function activityTracks(sessions: Session[], date: string, now: number): ActivityTrack[] {
  const [from, to] = dayBounds(date),
    groups = new Map<string, TrackSegment[]>();
  for (const segment of daySegments(sessions, { from, to }, now)) {
    const session = segment.session,
      id = (session.group_id ?? session.id) + ':' + session.category_id;
    const rows = groups.get(id) ?? [];
    rows.push(segment);
    groups.set(id, rows);
  }
  return [...groups].map(([id, rows]) => summarizeTrack(id, rows)).sort((a, b) => a.start - b.start);
}
export function trackRange(tracks: ActivityTrack[], date: string, wholeDay: boolean): TrackRange {
  const [start, end] = dayBounds(date),
    hour = 3600000;
  if (wholeDay || !tracks.length) return { from: start, to: end };
  const earliest = Math.min(...tracks.map((track) => track.start));
  const latest = Math.max(...tracks.map((track) => track.end));
  const from = Math.max(start, start + Math.floor((earliest - start) / hour) * hour);
  return {
    from,
    to: Math.min(end, Math.max(from + 3 * hour, start + Math.ceil((latest - start) / hour) * hour)),
  };
}
export function trackTicks(range: TrackRange, detailed = false): number[] {
  const hours = (range.to - range.from) / 3600000;
  const step = detailed ? 1 : Math.max(1, Math.ceil(hours / 8));
  const ticks = Array.from(
    { length: Math.floor(hours / step) + 1 },
    (_, index) => range.from + index * step * 3600000,
  );
  if (ticks.at(-1) !== range.to) ticks.push(range.to);
  return ticks;
}
export function trackPercent(timestamp: number, range: TrackRange): number {
  return Math.max(0, Math.min(100, ((timestamp - range.from) / (range.to - range.from)) * 100));
}
export function trackGeometry(segment: TrackSegment, range: TrackRange) {
  const left = trackPercent(segment.start, range);
  return { left, width: Math.max(0, trackPercent(segment.end, range) - left) };
}
