import type { Category, Session } from '../src/shared/api/contracts.ts';
import { dayBounds } from '../src/shared/lib/date.ts';
export const date = '2026-10-24';
export const [start, end] = dayBounds(date);
export const minute = 60000;
export function row(id: string, from: number, to: number | null, patch: Partial<Session> = {}): Session {
  return {
    id,
    category_id: 'video',
    title: 'Video',
    game_id: null,
    note: '',
    start_at: start + from * minute,
    end_at: to === null ? null : start + to * minute,
    created_at: start,
    ...patch,
  };
}
function category(id: string, name: string, sort_order: number): Category {
  return { id, name, sort_order, group_name: 'Group', color: '#123456', icon: 'play', is_work: false };
}
export const categories = [
  category('games', 'Игры', 0),
  category('video', 'YouTube', 1),
  category('work', 'Проекты', 2),
];
