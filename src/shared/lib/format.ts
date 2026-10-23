import type { DateValue } from '../api/contracts.ts';
export function clock(value: DateValue) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function weekday(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short' });
}

export function posterFailed(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}
