import type { DatabaseSync } from 'node:sqlite';
import type { Express } from 'express';
import { z } from 'zod';
import { dashboardCardsSchema } from '../src/shared/api/contracts.ts';
import type { DashboardCards } from '../src/shared/api/contracts.ts';
import { readRows, transaction } from './storage.ts';
import { ensure } from './http.ts';
export function initializeDashboardCards(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS dashboard_cards (category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,sort_order INTEGER NOT NULL)',
  );
}
export function readDashboardCards(db: DatabaseSync): DashboardCards {
  const rows = readRows(
    db,
    'SELECT category_id FROM dashboard_cards ORDER BY sort_order',
    z.object({ category_id: z.string() }),
  );
  return { category_ids: rows.map((row) => row.category_id) };
}
export function writeDashboardCards(db: DatabaseSync, cards: DashboardCards): void {
  db.exec('DELETE FROM dashboard_cards');
  const insert = db.prepare('INSERT INTO dashboard_cards VALUES (?,?)');
  cards.category_ids.forEach((id, index) => {
    insert.run(id, index);
  });
}
function saveDashboardCards(db: DatabaseSync, cards: DashboardCards): void {
  const category = db.prepare('SELECT 1 FROM categories WHERE id=?');
  ensure(
    cards.category_ids.every((id) => category.get(id)),
    'Категория карточки не найдена',
  );
  transaction(db, () => {
    writeDashboardCards(db, cards);
  });
}
export function registerDashboardCards(app: Express, db: DatabaseSync): void {
  initializeDashboardCards(db);
  app.get('/api/dashboard-cards', (_req, res) => {
    res.json(readDashboardCards(db));
  });
  app.patch('/api/dashboard-cards', (req, res) => {
    const cards = dashboardCardsSchema.parse(req.body);
    saveDashboardCards(db, cards);
    res.json(readDashboardCards(db));
  });
}
