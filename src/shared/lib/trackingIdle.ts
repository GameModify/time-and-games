import type { TrackerStatus } from '../api/trackingContracts.ts';
export function idleTimeout(status: TrackerStatus | null | undefined): number {
  return status?.idle_timeout_ms ?? 300000;
}
export function idleMinutes(timeout: number): string {
  const minutes = timeout / 60000;
  const plural = new Intl.PluralRules('ru').select(minutes);
  const word = plural === 'one' ? 'минута' : plural === 'few' ? 'минуты' : 'минут';
  return String(minutes) + ' ' + word;
}
export function inactivityMessage(status: TrackerStatus | null | undefined): string {
  return idleMinutes(idleTimeout(status)) + ' без действий, учёт приостановлен';
}
