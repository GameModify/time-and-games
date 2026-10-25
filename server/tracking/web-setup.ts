import type { DatabaseSync } from 'node:sqlite';
import { configuration, saveConfiguration } from './storage.ts';
import { transaction } from '../storage.ts';
export function setupWebTracking(db: DatabaseSync): void {
  renameWebCategory(db);
  db.exec('CREATE TABLE IF NOT EXISTS tracking_setup (feature TEXT PRIMARY KEY)');
  const config = configuration(db);
  if (!config.enabled || db.prepare('SELECT 1 FROM tracking_setup WHERE feature=?').get('web')) return;
  transaction(db, () => {
    if (!config.mappings.some((mapping) => mapping.activity === 'web')) {
      db.prepare(
        'INSERT OR IGNORE INTO categories (id,group_name,name,color,icon,is_work,sort_order) VALUES (?,?,?,?,?,?,?)',
      ).run('browser-web', 'Другое', 'Просмотр сайтов', '#8995bb', 'layers', 0, 100);
      saveConfiguration(db, {
        ...config,
        mappings: [...config.mappings, { activity: 'web', category_id: 'browser-web' }],
      });
    }
    db.prepare('INSERT INTO tracking_setup VALUES (?)').run('web');
  });
}

function renameWebCategory(db: DatabaseSync): void {
  db.prepare('UPDATE categories SET name=? WHERE id=? AND name=?').run(
    'Просмотр сайтов',
    'browser-web',
    'Работа с сайтами',
  );
}
