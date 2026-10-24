import type { DatabaseSync } from 'node:sqlite';
import {
  sessionSchema,
  timerSchema,
  timerGroupSchema,
  pausedTimerSchema,
} from '../../src/shared/api/contracts.ts';
import type { Session, Timer, TimerGroup, PausedTimer } from '../../src/shared/api/contracts.ts';
import { readRows } from '../storage.ts';
export function initializeTimers(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS timer_groups (id TEXT PRIMARY KEY,paused INTEGER NOT NULL DEFAULT 0);',
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS timer_segments (session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,group_id TEXT NOT NULL REFERENCES timer_groups(id) ON DELETE CASCADE);',
  );
  db.exec('CREATE INDEX IF NOT EXISTS idx_timer_segments_group ON timer_segments(group_id);');
}
export function timerDetails(db: DatabaseSync, session: Session): Timer {
  const link = db.prepare('SELECT group_id FROM timer_segments WHERE session_id=?').get(session.id);
  if (!link) return timerSchema.parse(session);
  const rows = readRows(
    db,
    'SELECT s.* FROM sessions s JOIN timer_segments l ON l.session_id=s.id WHERE l.group_id=? AND s.id<>?',
    sessionSchema,
    [String(link.group_id), session.id],
  );
  const elapsed_before = rows.reduce(
    (sum, item) => sum + Math.max(0, (item.end_at ?? item.start_at) - item.start_at),
    0,
  );
  return timerSchema.parse({ ...session, elapsed_before, timer_id: link.group_id });
}
export function pausedTimers(db: DatabaseSync): PausedTimer[] {
  const query =
    'SELECT s.* FROM timer_groups g JOIN timer_segments l ON l.group_id=g.id JOIN sessions s ON s.id=l.session_id WHERE g.paused=1 AND s.id=(SELECT latest.id FROM sessions latest JOIN timer_segments member ON member.session_id=latest.id WHERE member.group_id=g.id ORDER BY latest.start_at DESC,latest.created_at DESC,latest.rowid DESC LIMIT 1)';
  return readRows(db, query, sessionSchema).map((session) =>
    pausedTimerSchema.parse(timerDetails(db, session)),
  );
}
export function exportTimerGroups(db: DatabaseSync): TimerGroup[] {
  return db
    .prepare('SELECT id,paused FROM timer_groups')
    .all()
    .flatMap((row) => {
      const links = db
        .prepare('SELECT session_id FROM timer_segments WHERE group_id=?')
        .all(String(row.id));
      if (!links.length) return [];
      return [
        timerGroupSchema.parse({
          ...row,
          paused: Boolean(row.paused),
          session_ids: links.map((link) => link.session_id),
        }),
      ];
    });
}
export function restoreTimerGroups(db: DatabaseSync, groups: TimerGroup[]): void {
  db.exec('DELETE FROM timer_segments;DELETE FROM timer_groups;');
  for (const group of groups) {
    db.prepare('INSERT INTO timer_groups VALUES (?,?)').run(group.id, Number(group.paused));
    for (const id of group.session_ids)
      db.prepare('INSERT INTO timer_segments VALUES (?,?)').run(id, group.id);
  }
}
