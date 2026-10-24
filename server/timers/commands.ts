import type { DatabaseSync } from 'node:sqlite';
import type { Session, Timer } from '../../src/shared/api/contracts.ts';
import { sessionSchema } from '../../src/shared/api/contracts.ts';
import { ensure } from '../http.ts';
import { readRow, transaction } from '../storage.ts';
import { insertSession, newSession, sessionPlan } from '../sessions.ts';
import { timerDetails, pausedTimers } from './storage.ts';
function sessionById(db: DatabaseSync, id: string): Session {
  const session = readRow(db, 'SELECT * FROM sessions WHERE id=?', sessionSchema, [id]);
  ensure(session, 'Запись не найдена', 404);
  return session;
}
export function pauseTimer(db: DatabaseSync, id: string, now = Date.now()): Timer {
  return transaction(db, () => {
    const session = sessionById(db, id);
    ensure(session.end_at === null, 'Занятие уже остановлено', 409);
    const group = timerDetails(db, session).timer_id ?? session.id;
    const end = Math.max(now, session.start_at + 1);
    db.prepare('INSERT INTO timer_groups VALUES (?,1) ON CONFLICT(id) DO UPDATE SET paused=1').run(
      group,
    );
    db.prepare('INSERT OR IGNORE INTO timer_segments VALUES (?,?)').run(id, group);
    db.prepare('UPDATE sessions SET end_at=? WHERE id=?').run(end, id);
    return timerDetails(db, { ...session, end_at: end });
  });
}
export function resumeTimer(db: DatabaseSync, group: string, now = Date.now()): Timer {
  return transaction(db, () => {
    const previous = pausedTimers(db).find((timer) => timer.timer_id === group);
    ensure(previous, 'Занятие не находится на паузе', 409);
    const plan = sessionPlan(db, {
      category_id: previous.category_id,
      game_id: previous.game_id,
      title: previous.title,
      note: previous.note,
      start_at: now,
      end_at: null,
    });
    const next = newSession(plan, previous.category_id);
    insertSession(db, next);
    db.prepare('INSERT INTO timer_segments VALUES (?,?)').run(next.id, group);
    db.prepare('UPDATE timer_groups SET paused=0 WHERE id=?').run(group);
    return timerDetails(db, next);
  });
}
export function finishPausedTimer(db: DatabaseSync, group: string): void {
  ensure(
    db.prepare('UPDATE timer_groups SET paused=0 WHERE id=? AND paused=1').run(group).changes,
    'Занятие не находится на паузе',
    409,
  );
}
