import type {
  ActivityCategory,
  ActivitySession,
  TimelineSession,
} from '../../../shared/api/contracts.ts';
import { unionDuration, dayBounds, periodDays } from '../../../shared/lib/date.ts';
export function summarize<C extends ActivityCategory>(
  sessions: ActivitySession[],
  categories: C[],
  from: number,
  to: number,
  now = Date.now(),
) {
  const clipped = clipSessions(sessions, from, to, now);
  const byCategory = categories.map((c) => ({
    ...c,
    duration: unionDuration(clipped.filter((s) => s.category_id === c.id).map((s) => s.interval)),
  }));
  return {
    total: unionDuration(clipped.map((s) => s.interval)),
    work: workDuration(clipped, categories),
    byCategory,
    count: clipped.length,
    categoryTotal: byCategory.reduce((sum, c) => sum + c.duration, 0),
  };
}

function workDuration(sessions: ReturnType<typeof clipSessions>, categories: ActivityCategory[]) {
  const ids = new Set(categories.filter((category) => category.is_work).map((category) => category.id));
  return unionDuration(
    sessions.filter((session) => ids.has(session.category_id)).map((session) => session.interval),
  );
}

export function activityBuckets<C extends ActivityCategory>(
  sessions: ActivitySession[],
  categories: C[],
  date: string,
  view: string,
  now = Date.now(),
) {
  const days = periodDays(date, view);
  if (view !== 'day')
    return days.map((d) => ({
      key: d,
      date: d,
      label: d.slice(-2),
      ...summarize(sessions, categories, ...dayBounds(d), now),
    }));
  return hourlyBuckets(sessions, categories, date, now);
}

export function timelineLayout<S extends TimelineSession>(
  sessions: S[],
  from: number,
  to: number,
  now = Date.now(),
) {
  const items = timelineItems(sessions, from, to, now);
  let cluster: (S & { start: number; end: number; lane: number; lanes: number })[] = [],
    clusterEnd = 0;
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) {
      assignLanes(cluster);
      cluster = [];
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  assignLanes(cluster);
  return items;
}

export function timelineRect(start: number, end: number, origin: number, pixelsPerHour = 72) {
  return {
    top: ((start - origin) / 3600000) * pixelsPerHour,
    height: ((end - start) / 3600000) * pixelsPerHour,
  };
}

function clipSessions(sessions: ActivitySession[], from: number, to: number, now: number) {
  return sessions
    .map((s) => ({
      ...s,
      interval: [Math.max(s.start_at, from), Math.min(s.end_at ?? now, to)] as [number, number],
    }))
    .filter((s) => s.interval[1] > s.interval[0]);
}

function hourlyBuckets<C extends ActivityCategory>(
  sessions: ActivitySession[],
  categories: C[],
  date: string,
  now: number,
) {
  const [start, end] = dayBounds(date);
  const buckets = [];
  for (let from = start; from < end; from += 3600000) {
    const to = Math.min(from + 3600000, end);
    const label = new Date(from).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    buckets.push({ key: String(from), date, label, ...summarize(sessions, categories, from, to, now) });
  }
  return buckets;
}

function timelineItems<S extends TimelineSession>(sessions: S[], from: number, to: number, now: number) {
  return sessions
    .map((s) => ({
      ...s,
      start: Math.max(from, s.start_at),
      end: Math.min(to, s.end_at ?? now),
      lane: 0,
      lanes: 1,
    }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
}

interface TimelinePlacement {
  start: number;
  end: number;
  lane: number;
  lanes: number;
}
function assignLanes(cluster: TimelinePlacement[]) {
  const lanes: number[] = [];
  for (const item of cluster) {
    let lane = lanes.findIndex((end) => end <= item.start);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = item.end;
    item.lane = lane;
  }
  cluster.forEach((item) => {
    item.lanes = lanes.length;
  });
}
