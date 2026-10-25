import type { ActivityTrack } from '../../../entities/activity/index.ts';
import type { Session } from '../../../shared/api/contracts.ts';
export type ItemOrder = 'recent' | 'oldest' | 'duration-desc' | 'duration-asc' | 'name';
export const itemOrders: { value: ItemOrder; label: string }[] = [
  { value: 'recent', label: 'Последний заход: сначала новые' },
  { value: 'oldest', label: 'Последний заход: сначала старые' },
  { value: 'duration-desc', label: 'Время: сначала больше' },
  { value: 'duration-asc', label: 'Время: сначала меньше' },
  { value: 'name', label: 'Название: А–Я' },
];
export function sortTimelineItems(items: ActivityTrack[], order: ItemOrder): ActivityTrack[] {
  return items.toSorted((a, b) => {
    if (order === 'name') return a.title.localeCompare(b.title, 'ru') || a.id.localeCompare(b.id);
    if (order === 'oldest') return lastVisit(a) - lastVisit(b) || a.id.localeCompare(b.id);
    if (order === 'duration-desc')
      return b.elapsed - a.elapsed || lastVisit(b) - lastVisit(a) || a.id.localeCompare(b.id);
    if (order === 'duration-asc')
      return a.elapsed - b.elapsed || lastVisit(b) - lastVisit(a) || a.id.localeCompare(b.id);
    return lastVisit(b) - lastVisit(a) || a.id.localeCompare(b.id);
  });
}
export function websiteSession(item: ActivityTrack): Session | undefined {
  const sessions = item.segments.map((segment) => segment.session);
  const hosts = new Set(sessions.map((session) => session.tracking_context?.website));
  const first = sessions[0];
  return hosts.size === 1 &&
    first?.tracking_context?.website &&
    !first.tracking_context.media_id &&
    !first.tracking_context.media_creator
    ? first
    : undefined;
}

export function lastVisit(item: ActivityTrack): number {
  return Math.max(...item.segments.map((segment) => segment.session.start_at));
}
