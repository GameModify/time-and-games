import { localDate } from './date.ts';
export function dateInPeriod(date: string | null, period: string, today = localDate()) {
  if (period === 'all') return true;
  if (period === 'undated') return !date;
  if (!date) return false;
  const year = Number(today.slice(0, 4)),
    month = today.slice(0, 7);
  if (period === 'month') return date.slice(0, 7) === month;
  if (period === 'last-month') {
    const first = new Date(`${month}-01T12:00:00`);
    first.setMonth(first.getMonth() - 1);
    return date.slice(0, 7) === localDate(first).slice(0, 7);
  }
  if (period === 'year') return date.slice(0, 4) === String(year);
  if (period === 'last-year') return date.slice(0, 4) === String(year - 1);
  if (period === 'earlier') return date < `${year}-01-01`;
  return /^year:\d{4}$/.test(period) && date.slice(0, 4) === period.slice(5);
}
