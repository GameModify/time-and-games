import type { DatabaseSync } from 'node:sqlite';
import type { Express } from 'express';
import { z } from 'zod';
import { dashboardCardsSchema, defaultDashboardCards } from '../src/shared/api/contracts.ts';
import { dashboardCardSchema, dashboardCardKey } from '../src/shared/api/dashboardContracts.ts';
import type { DashboardCard, DashboardCards } from '../src/shared/api/contracts.ts';
import { readRows, transaction } from './storage.ts';
import { ensure } from './http.ts';
function createLayoutTables(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS dashboard_card_layout (card_key TEXT PRIMARY KEY,kind TEXT NOT NULL,metric TEXT,category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,sort_order INTEGER NOT NULL)',
  );
  db.exec('CREATE TABLE IF NOT EXISTS dashboard_card_preferences (id INTEGER PRIMARY KEY CHECK(id=1))');
}
export function initializeDashboardCards(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS dashboard_cards (category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,sort_order INTEGER NOT NULL)',
  );
  createLayoutTables(db);
  if (db.prepare('SELECT 1 FROM dashboard_card_preferences').get()) return;
  const rows = readRows(
    db,
    'SELECT category_id FROM dashboard_cards ORDER BY sort_order',
    z.object({ category_id: z.string() }),
  );
  const cards = dashboardCardsSchema.parse({ category_ids: rows.map((row) => row.category_id) });
  transaction(db, () => {
    writeDashboardCards(db, cards);
  });
}
const storedCardSchema = z.object({
  kind: z.string(),
  metric: z.string().nullable(),
  category_id: z.string().nullable(),
});
function decodeCard(row: z.infer<typeof storedCardSchema>): DashboardCard {
  return dashboardCardSchema.parse(
    row.kind === 'metric'
      ? { kind: row.kind, metric: row.metric }
      : { kind: row.kind, category_id: row.category_id },
  );
}
export function readDashboardCards(db: DatabaseSync): DashboardCards {
  const rows = readRows(
    db,
    'SELECT kind,metric,category_id FROM dashboard_card_layout ORDER BY sort_order',
    storedCardSchema,
  );
  return { cards: rows.map(decodeCard) };
}
export function writeDashboardCards(db: DatabaseSync, cards: DashboardCards): void {
  db.exec(
    'INSERT OR IGNORE INTO dashboard_card_preferences VALUES (1); DELETE FROM dashboard_card_layout',
  );
  const insert = db.prepare('INSERT INTO dashboard_card_layout VALUES (?,?,?,?,?)');
  cards.cards.forEach((card, index) => {
    insert.run(
      dashboardCardKey(card),
      card.kind,
      card.kind === 'metric' ? card.metric : null,
      card.kind === 'category' ? card.category_id : null,
      index,
    );
  });
}
export function resetDashboardCards(db: DatabaseSync): void {
  writeDashboardCards(db, defaultDashboardCards());
}
function saveDashboardCards(db: DatabaseSync, cards: DashboardCards): void {
  const category = db.prepare('SELECT 1 FROM categories WHERE id=?');
  ensure(
    cards.cards.every((card) => card.kind === 'metric' || category.get(card.category_id)),
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
    saveDashboardCards(db, dashboardCardsSchema.parse(req.body));
    res.json(readDashboardCards(db));
  });
}
