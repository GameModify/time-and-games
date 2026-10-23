import { unionDuration, dayBounds, periodDays } from '../../../shared/lib/date.js';
export function summarize(sessions, categories, from, to, now = Date.now()) {
  const clipped = sessions
    .map((s) => ({ ...s, interval: [Math.max(s.start_at, from), Math.min(s.end_at ?? now, to)] }))
    .filter((s) => s.interval[1] > s.interval[0]);
  const byCategory = categories.map((c) => ({
    ...c,
    duration: unionDuration(clipped.filter((s) => s.category_id === c.id).map((s) => s.interval)),
  }));
  const workIds = new Set(categories.filter((c) => c.is_work).map((c) => c.id));
  return {
    total: unionDuration(clipped.map((s) => s.interval)),
    work: unionDuration(clipped.filter((s) => workIds.has(s.category_id)).map((s) => s.interval)),
    byCategory,
    count: clipped.length,
    categoryTotal: byCategory.reduce((sum, c) => sum + c.duration, 0),
  };
}

export function activityBuckets(sessions, categories, date, view, now = Date.now()) {
  const days = periodDays(date, view);
  if (view !== 'day')
    return days.map((d) => ({
      key: d,
      date: d,
      label: d.slice(-2),
      ...summarize(sessions, categories, ...dayBounds(d), now),
    }));
  const [start, end] = dayBounds(date);
  const buckets = [];
  for (let from = start; from < end; from += 3600000) {
    const to = Math.min(from + 3600000, end);
    const label = new Date(from).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    buckets.push({ key: String(from), date, label, ...summarize(sessions, categories, from, to, now) });
  }
  return buckets;
}

export function timelineLayout(sessions, from, to, now = Date.now()) {
  const items = sessions
    .map((s) => ({ ...s, start: Math.max(from, s.start_at), end: Math.min(to, s.end_at ?? now) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = [],
    clusterEnd = 0;
  function flush() {
    const lanes = [];
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
  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) {
      flush();
      cluster = [];
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return items;
}

export function timelineRect(start, end, origin, pixelsPerHour = 72) {
  return {
    top: ((start - origin) / 3600000) * pixelsPerHour,
    height: ((end - start) / 3600000) * pixelsPerHour,
  };
}
