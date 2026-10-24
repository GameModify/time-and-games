import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { Session, SessionContext } from '../src/shared/api/contracts.ts';
export function initializeSessionContext(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS session_context (session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,website TEXT,project TEXT)',
  );
}
export function saveSessionContext(
  db: DatabaseSync,
  session: Pick<Session, 'id' | 'tracking_context'>,
): void {
  const context = session.tracking_context;
  if (!context?.website && !context?.project) return;
  initializeSessionContext(db);
  db.prepare('INSERT OR REPLACE INTO session_context VALUES (?,?,?)').run(
    session.id,
    context.website ?? null,
    context.project ?? null,
  );
}
const rowSchema = z.object({
  session_id: z.string(),
  website: z.string().nullable(),
  project: z.string().nullable(),
});
export function withSessionContext(db: DatabaseSync, sessions: Session[]): Session[] {
  initializeSessionContext(db);
  if (!sessions.length) return [];
  const ids = sessions.map((session) => session.id);
  const query =
    'SELECT * FROM session_context WHERE session_id IN (' + ids.map(() => '?').join(',') + ')';
  const rows = rowSchema.array().parse(db.prepare(query).all(...ids));
  const contexts = new Map<string, SessionContext>(
    rows.map((row) => [
      row.session_id,
      { website: row.website ?? undefined, project: row.project ?? undefined },
    ]),
  );
  return sessions.map((session) => ({ ...session, tracking_context: contexts.get(session.id) }));
}
