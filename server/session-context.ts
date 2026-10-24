import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { Session, SessionContext } from '../src/shared/api/contracts.ts';
export function initializeSessionContext(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS session_context (session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,website TEXT,project TEXT)',
  );
  const columns = db
    .prepare('PRAGMA table_info(session_context)')
    .all()
    .map((row) => String(row.name));
  for (const column of ['app', 'media_creator', 'media_id'])
    if (!columns.includes(column)) db.exec('ALTER TABLE session_context ADD COLUMN ' + column + ' TEXT');
}
export function saveSessionContext(
  db: DatabaseSync,
  session: Pick<Session, 'id' | 'tracking_context'>,
): void {
  const context = session.tracking_context;
  if (!context) return;
  initializeSessionContext(db);
  db.prepare(
    'INSERT OR REPLACE INTO session_context (session_id,website,project,app,media_creator,media_id) VALUES (?,?,?,?,?,?)',
  ).run(
    session.id,
    context.website ?? null,
    context.project ?? null,
    context.app ?? null,
    context.media_creator ?? null,
    context.media_id ?? null,
  );
}
const rowSchema = z.object({
  session_id: z.string(),
  app: z.string().nullable(),
  media_creator: z.string().nullable(),
  media_id: z.string().nullable(),
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
  const contexts = new Map(rows.map((row) => [row.session_id, rowContext(row)]));
  return sessions.map((session) => ({ ...session, tracking_context: contexts.get(session.id) }));
}

function rowContext(row: z.infer<typeof rowSchema>): SessionContext {
  return {
    website: row.website ?? undefined,
    project: row.project ?? undefined,
    ...(row.app === null ? {} : { app: row.app }),
    ...(row.media_creator === null ? {} : { media_creator: row.media_creator }),
    ...(row.media_id === null ? {} : { media_id: row.media_id }),
  };
}
