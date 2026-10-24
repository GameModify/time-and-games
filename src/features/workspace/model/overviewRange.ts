import { recentTrackRange } from '../../../entities/activity/index.ts';
import type { RecentTrackHours } from '../../../entities/activity/index.ts';
export interface OverviewPeriod {
  calendar: [number, number];
  hours: RecentTrackHours | null;
  now: number;
  rolling: boolean;
}
export function overviewRange(period: OverviewPeriod): [number, number] {
  if (!period.rolling || period.hours === null) return period.calendar;
  const range = recentTrackRange(period.now, period.hours);
  return [range.from, range.to];
}
