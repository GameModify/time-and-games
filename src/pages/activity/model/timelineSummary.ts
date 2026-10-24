import type { CategoryLane, RecentTrackHours } from '../../../entities/activity/index.ts';
export type TimelineOrder = 'asc' | 'desc';
export function sortedLanes(lanes: CategoryLane[], order: TimelineOrder): CategoryLane[] {
  return lanes.toSorted((left, right) =>
    order === 'desc' ? right.elapsed - left.elapsed : left.elapsed - right.elapsed,
  );
}
export function recentHoursLabel(hours: RecentTrackHours): string {
  return ['Последние', String(hours), hours === 2 || hours === 24 ? 'часа' : 'часов'].join(' ');
}
