import { localDate } from './date.ts';
export const pagePaths = {
  dashboard: '/',
  games: '/games',
  media: '/media',
  analytics: '/statistics',
  settings: '/settings',
} as const;
export type Page = keyof typeof pagePaths;
export type CalendarView = 'day' | 'week' | 'month';
export type CalendarDisplay = 'timeline' | 'list';
export interface NavigationState {
  page: Page;
  date: string;
  view: CalendarView;
  display: CalendarDisplay;
}
export function isPage(value: unknown): value is Page {
  return typeof value === 'string' && Object.hasOwn(pagePaths, value);
}
export function isCalendarView(value: string): value is CalendarView {
  return value === 'day' || value === 'week' || value === 'month';
}
const pathPages: Record<string, Page | undefined> = {
  '/': 'dashboard',
  '/games': 'games',
  '/media': 'media',
  '/statistics': 'analytics',
  '/analytics': 'analytics',
  '/settings': 'settings',
  '/setting': 'settings',
};
export function readNavigation(address: string, today = localDate()): NavigationState {
  const url = new URL(address.startsWith('#') ? '/' + address : address, 'http://localhost');
  const legacy = url.pathname === '/' && url.hash.startsWith('#page=');
  const values = new URLSearchParams(legacy ? url.hash.slice(1) : url.search);
  const oldPage = values.get('page');
  const page =
    legacy && isPage(oldPage)
      ? oldPage
      : (pathPages[url.pathname.replace(/\/+$/, '') || '/'] ?? 'dashboard');
  const date = values.get('date');
  const view = values.get('view') ?? '';
  return {
    page,
    date: validNavigationDate(date) ? date : today,
    view: isCalendarView(view) ? view : 'day',
    display: values.get('display') === 'list' ? 'list' : 'timeline',
  };
}
function validNavigationDate(date: string | null): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && localDate(new Date(`${date}T12:00:00`)) === date;
}
export function navigationUrl(state: NavigationState, today = localDate()): string {
  const path = pagePaths[state.page];
  if (state.page === 'games' || state.page === 'settings' || state.page === 'media') return path;
  const query = new URLSearchParams();
  if (state.date !== today) query.set('date', state.date);
  if (state.view !== 'day') query.set('view', state.view);
  if (state.display !== 'timeline') query.set('display', state.display);
  const suffix = query.toString();
  return path + (suffix ? '?' + suffix : '');
}
