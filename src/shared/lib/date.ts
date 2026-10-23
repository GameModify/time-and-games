import type { DateValue } from '../api/contracts.ts';
export function localDate(value: DateValue = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayBounds(date: string): [number, number] {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [+start, +end];
}

export function shiftDate(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + amount);
  return localDate(d);
}

export function periodDays(date: string, view: string) {
  if (view === 'day') return [date];
  const d = new Date(`${date}T12:00:00`);
  if (view === 'week') {
    const first = shiftDate(date, -((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => shiftDate(first, i));
  }
  const first = `${date.slice(0, 7)}-01`;
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => shiftDate(first, i));
}

export function unionDuration(intervals: [number, number][]) {
  const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let total = 0,
    right = -Infinity;
  for (const [a, b] of sorted) {
    total += Math.max(0, b - Math.max(a, right));
    right = Math.max(right, b);
  }
  return total;
}

export function duration(ms: number, seconds = false) {
  const value = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(value / 3600),
    m = Math.floor(value / 60) % 60,
    s = value % 60;
  return seconds
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : h
      ? `${h} ч ${m} м`
      : `${m} м`;
}

export function localInput(value: DateValue) {
  const d = new Date(value);
  return `${localDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
