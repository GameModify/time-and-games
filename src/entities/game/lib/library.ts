import type { Game, NumericInput } from '../../../shared/api/contracts.ts';
import { localDate } from '../../../shared/lib/date.ts';
import { dateInPeriod } from '../../../shared/lib/datePeriod.ts';

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
  return dateInPeriod(game.completed_at, period, today);
}
export function gamePeriodDate(
  game: Pick<Game, 'status' | 'started_at' | 'completed_at'>,
  status: string,
) {
  return status === 'completed' || (status === 'all' && game.status === 'completed')
    ? game.completed_at
    : game.started_at;
}
