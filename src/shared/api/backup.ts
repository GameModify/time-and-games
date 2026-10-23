import { backupSchema } from './contracts.ts';
import type { Backup } from './contracts.ts';
export async function readBackupFile(file: File): Promise<Backup> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше 25 МБ');
  const data: unknown = JSON.parse(await file.text());
  return backupSchema.parse(data);
}
