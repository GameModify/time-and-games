import type { Game, NumericInput } from '../../../shared/api/contracts.ts';
import { localDate } from '../../../shared/lib/date.ts';

export function playtimeFields(total: number) {
  const minutes = Math.max(0, total || 0);
  return { hours: Math.floor(minutes / 60) || '', minutes: minutes % 60 || '' };
}

export function playtimeMinutes(hours: NumericInput, minutes: NumericInput) {
  const h = Number(hours || 0),
    m = Number(minutes || 0);
  if (
    !Number.isSafeInteger(h) ||
    h < 0 ||
    !Number.isSafeInteger(m) ||
    m < 0 ||
    m > 59 ||
    !Number.isSafeInteger(h * 60 + m)
  )
    throw new Error('Укажи целые часы и минуты от 0 до 59');
  return h * 60 + m;
}

export function gameMinutes(game: Pick<Game, 'playtime_minutes' | 'total_minutes'>) {
  return game.total_minutes ?? game.playtime_minutes;
}

export function completedInPeriod(
  game: Pick<Game, 'status' | 'completed_at'>,
  period: string,
  today = localDate(),
) {
  if (period === 'all') return true;
  if (game.status !== 'completed') return false;
  const completed = game.completed_at;
  if (period === 'undated') return !completed;
  if (!completed) return false;
  const year = Number(today.slice(0, 4)),
    month = today.slice(0, 7);
  if (period === 'month') return completed.slice(0, 7) === month;
  if (period === 'last-month') {
    const first = new Date(`${month}-01T12:00:00`);
    first.setMonth(first.getMonth() - 1);
    return completed.slice(0, 7) === localDate(first).slice(0, 7);
  }
  if (period === 'year') return completed.slice(0, 4) === String(year);
  if (period === 'last-year') return completed.slice(0, 4) === String(year - 1);
  if (period === 'earlier') return completed < `${year}-01-01`;
  if (/^year:\d{4}$/.test(period)) return completed.slice(0, 4) === period.slice(5);
  return false;
}
