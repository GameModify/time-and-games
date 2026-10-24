import type { DatabaseSync } from 'node:sqlite';
import { configuration, saveConfiguration } from './storage.ts';
import { transaction } from '../storage.ts';
function youtubeCategory(db: DatabaseSync): string {
  const category = db
    .prepare("SELECT id FROM categories WHERE name LIKE '%YouTube%' ORDER BY sort_order LIMIT 1")
    .get();
  if (category) return String(category.id);
  db.prepare(
    'INSERT OR IGNORE INTO categories (id,group_name,name,color,icon,is_work,sort_order) VALUES (?,?,?,?,?,?,?)',
  ).run('browser-youtube', 'Развлечения', 'Просмотр YouTube', '#ee657e', 'play', 0, 101);
  return 'browser-youtube';
}
export function setupYouTube(db: DatabaseSync): void {
  const config = configuration(db);
  if (!config.enabled || config.mappings.some((mapping) => mapping.activity === 'youtube')) return;
  transaction(db, () => {
    saveConfiguration(db, {
      ...config,
      mappings: [...config.mappings, { activity: 'youtube', category_id: youtubeCategory(db) }],
    });
  });
}
