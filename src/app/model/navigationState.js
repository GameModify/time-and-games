import { localDate } from '../../shared/lib/date.js';
export function readNavigation(hash, today = localDate()) {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  const date = values.get('date');
  return {
    page: ['dashboard', 'games', 'analytics', 'settings'].includes(values.get('page'))
      ? values.get('page')
      : 'dashboard',
    date:
      date && /^\d{4}-\d{2}-\d{2}$/.test(date) && localDate(new Date(`${date}T12:00:00`)) === date
        ? date
        : today,
    view: ['day', 'week', 'month'].includes(values.get('view')) ? values.get('view') : 'day',
    display: values.get('display') === 'list' ? 'list' : 'timeline',
  };
}
export function navigationHash(state) {
  return '#' + new URLSearchParams(state).toString();
}
