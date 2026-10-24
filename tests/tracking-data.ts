import type { DatabaseSync } from 'node:sqlite';
import type { TrackingConnection } from '../src/shared/api/trackingContracts.ts';
export const unavailableConnection: TrackingConnection = {
  enabled: true,
  endpoint: 'http://127.0.0.1:1',
  token: 'a'.repeat(64),
  auto_import: false,
  mappings: [],
};
export function totalDuration(db: DatabaseSync): number {
  return Number(db.prepare('SELECT SUM(end_at-start_at) AS total FROM sessions').get()?.total);
}

export function addManualCoverage(db: DatabaseSync, start: number): void {
  db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)').run(
    'manual',
    'coding',
    null,
    'Manual',
    '',
    start + 20000,
    start + 80000,
    start,
  );
}
