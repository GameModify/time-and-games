import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { ZodType } from 'zod';
export function readRows<T>(
  db: DatabaseSync,
  query: string,
  schema: ZodType<T>,
  params: SQLInputValue[] = [],
): T[] {
  return schema.array().parse(db.prepare(query).all(...params));
}
export function readRow<T>(
  db: DatabaseSync,
  query: string,
  schema: ZodType<T>,
  params: SQLInputValue[] = [],
): T | undefined {
  const row = db.prepare(query).get(...params);
  return row === undefined ? undefined : schema.parse(row);
}
export function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec('BEGIN');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}
