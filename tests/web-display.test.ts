import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration } from '../src/shared/lib/date.ts';
import { setupWebTracking } from '../server/tracking/web-setup.ts';
import { DatabaseSync } from 'node:sqlite';
import { initializeTracking } from '../server/tracking/storage.ts';
void test('duration uses an unambiguous minute suffix in short and hour formats', () => {
  assert.equal(duration(15 * 60000), '15 мин');
  assert.equal(duration(67 * 60000), '1 ч 7 мин');
  assert.equal(duration(0), '0 мин');
  assert.equal(duration(15000, true), '00:00:15');
});
void test('the default website category is renamed without replacing custom names', () => {
  const db = websiteDatabase();
  try {
    setupWebTracking(db);
    assert.equal(
      db.prepare('SELECT name FROM categories WHERE id=?').get('browser-web')?.name,
      'Просмотр сайтов',
    );
    db.prepare('UPDATE categories SET name=? WHERE id=?').run('Личное название', 'browser-web');
    setupWebTracking(db);
    assert.equal(
      db.prepare('SELECT name FROM categories WHERE id=?').get('browser-web')?.name,
      'Личное название',
    );
  } finally {
    db.close();
  }
});

function websiteDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE categories(id TEXT PRIMARY KEY,group_name TEXT,name TEXT,color TEXT,icon TEXT,is_work INTEGER,sort_order INTEGER)',
  );
  db.prepare('INSERT INTO categories VALUES (?,?,?,?,?,?,?)').run(
    'browser-web',
    'Другое',
    'Работа с сайтами',
    '#123456',
    'layers',
    0,
    100,
  );
  initializeTracking(db);
  return db;
}
