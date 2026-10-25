import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  dashboardCardKey,
  dashboardCardsSchema,
  defaultDashboardCards,
} from '../src/shared/api/dashboardContracts.ts';
import {
  initializeDashboardCards,
  readDashboardCards,
  writeDashboardCards,
} from '../server/dashboard-cards.ts';
import { dashboardMetrics, categoryMetricChoices } from '../src/pages/activity/model/metrics.ts';
import type { MetricContext } from '../src/pages/activity/model/metrics.ts';
import { summarize } from '../src/entities/activity/index.ts';
import { categories, start, end, row } from './timeline-fixture.ts';
const context: MetricContext = {
  summary: summarize([row('a', 0, 60)], categories, start, end, end),
  active: 2,
  analytics: false,
  period: 'За выбранный день',
};
void test('only selected dashboard metrics render, in order, including an empty layout', () => {
  const cards = dashboardCardsSchema.parse({
    cards: [
      { kind: 'category', category_id: 'video' },
      { kind: 'metric', metric: 'total' },
    ],
  });
  const views = dashboardMetrics(cards, context);
  assert.deepEqual(
    views.map((card) => card.id),
    ['category:video', 'metric:total'],
  );
  assert.equal(views[0]?.value, '1 ч 0 min');
  assert.deepEqual(dashboardMetrics({ cards: [] }, context), []);
});
void test('timer cards adapt to analytics and unknown categories are omitted', () => {
  const cards = dashboardCardsSchema.parse({
    cards: [
      { kind: 'metric', metric: 'timers' },
      { kind: 'category', category_id: 'missing' },
    ],
  });
  const normal = dashboardMetrics(cards, context);
  assert.equal(normal.length, 1);
  assert.equal(normal[0]?.label, 'Активных таймеров');
  const analytics = dashboardMetrics(cards, { ...context, analytics: true });
  assert.equal(analytics[0]?.label, 'Записей за период');
  assert.equal(analytics[0].value, '1');
});
void test('old category selections retain default metrics without duplicating game time', () => {
  const cards = dashboardCardsSchema.parse({ category_ids: ['fun-games', 'video'] });
  assert.equal(cards.cards.length, 5);
  assert.equal(cards.cards.filter((card) => dashboardCardKey(card) === 'metric:games').length, 1);
  const game = {
    ...categories[0],
    id: 'fun-games',
    name: 'Игры',
    group_name: 'Развлечения',
    icon: 'gamepad',
    color: '#123456',
    is_work: false,
    sort_order: 0,
  };
  assert.ok(!categoryMetricChoices([game]).length);
});
function legacyDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE categories(id TEXT PRIMARY KEY)');
  db.exec("INSERT INTO categories VALUES ('fun-games'),('fun-video')");
  db.exec(
    'CREATE TABLE dashboard_cards(category_id TEXT PRIMARY KEY REFERENCES categories(id),sort_order INTEGER)',
  );
  db.exec("INSERT INTO dashboard_cards VALUES ('fun-games',0),('fun-video',1)");
  return db;
}
void test('SQLite migration retains old choices and never re-enables explicitly hidden cards', () => {
  const db = legacyDatabase();
  initializeDashboardCards(db);
  const first = readDashboardCards(db);
  assert.equal(first.cards.length, 5);
  assert.deepEqual(first.cards.slice(0, 4), defaultDashboardCards().cards);
  writeDashboardCards(db, { cards: [] });
  initializeDashboardCards(db);
  assert.deepEqual(readDashboardCards(db).cards, []);
  db.close();
});
