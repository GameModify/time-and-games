import { configuration } from './storage.ts';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { ContentLabel } from '../../src/shared/api/trackingContracts.ts';
export function categoryLabels(db: DatabaseSync): ContentLabel[] {
  const rows = z
    .object({ id: z.string(), name: z.string(), color: z.string() })
    .array()
    .parse(db.prepare('SELECT id,name,color FROM categories ORDER BY sort_order,id LIMIT 200').all());
  const mappings = configuration(db).mappings;
  return rows.map((row) => ({
    ...row,
    activity: 'tng:' + row.id,
    aliases: mappings
      .filter((mapping) => mapping.category_id === row.id)
      .map((mapping) => mapping.activity),
  }));
}
