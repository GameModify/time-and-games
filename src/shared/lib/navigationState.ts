import { localDate } from './date.ts';
export function readNavigation(hash: string, today = localDate()) {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  const date = values.get('date');
  const page = values.get('page') ?? '';
  const view = values.get('view') ?? '';
  return {
    page: ['dashboard', 'games', 'analytics', 'settings'].includes(page) ? page : 'dashboard',
    date:
      date && /^\d{4}-\d{2}-\d{2}$/.test(date) && localDate(new Date(`${date}T12:00:00`)) === date
        ? date
        : today,
    view: ['day', 'week', 'month'].includes(view) ? view : 'day',
    display: values.get('display') === 'list' ? 'list' : 'timeline',
  };
}
export function navigationHash(state: Record<string, string>) {
  return '#' + new URLSearchParams(state).toString();
}
