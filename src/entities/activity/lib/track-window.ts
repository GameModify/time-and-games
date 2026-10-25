import type { TrackRange } from './tracks.ts';
const minute = 60000;
export const recentHourOptions = [2, 6, 8, 12, 24] as const;
export type RecentTrackHours = (typeof recentHourOptions)[number];
export function recentTrackRange(now: number, hours: RecentTrackHours): TrackRange {
  return { from: now - hours * 3600000, to: now };
}
export function selectedTrackRange(range: TrackRange, first: number, last: number): TrackRange {
  const span = range.to - range.from;
  const left = Math.max(0, Math.min(1, Math.min(first, last)));
  const right = Math.max(0, Math.min(1, Math.max(first, last)));
  const from = range.from + left * span;
  const to = range.from + right * span;
  return {
    from: Math.max(range.from, Math.min(from, range.to - minute)),
    to: Math.min(range.to, Math.max(to, from + minute)),
  };
}
export function focusedTrackRange(range: TrackRange, bounds: TrackRange): TrackRange {
  const padding = Math.max(minute, (range.to - range.from) * 0.08);
  return {
    from: Math.max(bounds.from, range.from - padding),
    to: Math.min(bounds.to, range.to + padding),
  };
}
export function zoomTrackRange(range: TrackRange, now: number): TrackRange {
  const center = now > range.from && now < range.to ? now : (range.from + range.to) / 2;
  const half = Math.max(minute / 2, (range.to - range.from) / 4);
  const from = Math.max(range.from, Math.min(center - half, range.to - half * 2));
  return { from, to: Math.min(range.to, from + half * 2) };
}
export function shiftedTrackRange(range: TrackRange, bounds: TrackRange, direction: number): TrackRange {
  const width = range.to - range.from;
  const from = Math.max(bounds.from, Math.min(bounds.to - width, range.from + (direction * width) / 2));
  return { from, to: from + width };
}
export function overviewTicks(range: TrackRange, maxIntervals = 5): number[] {
  if (maxIntervals <= 1) return [range.from, range.to];
  const steps = [1, 5, 15, 30, 60, 120, 180, 360, 720].map((value) => value * minute);
  const step = steps.find((value) => (range.to - range.from) / value <= maxIntervals) ?? 12 * 3600000;
  const ticks = [range.from];
  const offset = new Date(range.from).getTimezoneOffset() * minute;
  for (let tick = Math.ceil((range.from - offset) / step) * step + offset; tick < range.to; tick += step)
    if (tick - (ticks.at(-1) ?? range.from) >= step * 0.65) ticks.push(tick);
  if (range.to - (ticks.at(-1) ?? range.from) < step * 0.65 && ticks.length > 1) ticks.pop();
  if (ticks.at(-1) !== range.to) ticks.push(range.to);
  return ticks;
}
