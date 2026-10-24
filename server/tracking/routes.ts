import { setupWebTracking } from './web-setup.ts';
import { gameApplicationRules } from './game-app.ts';
import { gameApplicationSchema } from '../../src/shared/api/trackingContracts.ts';
import { backfillGroups } from './backfill.ts';
import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  trackingConnectionSchema,
  trackingImportSchema,
  trackingIgnoreSchema,
  trackingRulesWriteSchema,
} from '../../src/shared/api/trackingContracts.ts';
import { ensure } from '../http.ts';
import { TrackingController } from './controller.ts';
import { configuration, initializeTracking, inbox, markInbox, updateConfiguration } from './storage.ts';
import { pauseTracker, readRules, saveRules, validateEndpoint } from './http.ts';
import { importInterval } from './import.ts';
function connectionRoutes(app: Express, controller: TrackingController): void {
  const db = controller.db;
  app.get('/api/tracking', (_req, res) => {
    res.json(controller.state());
  });
  app.patch('/api/tracking', async (req, res) => {
    const input = trackingConnectionSchema.parse(req.body);
    validateEndpoint(input.endpoint);
    ensure(!controller.syncing, 'Подожди окончания синхронизации', 409);
    ensure(!input.enabled || Boolean(input.token ?? configuration(db).token), 'Укажи ключ подключения');
    updateConfiguration(db, input);
    setupWebTracking(db);
    await controller.sync();
    res.json(controller.state());
  });
  app.post('/api/tracking/sync', async (_req, res) => {
    res.json({ added: await controller.sync(), state: controller.state() });
  });
}
function importRoutes(app: Express, db: DatabaseSync): void {
  app.get('/api/tracking/inbox', (_req, res) => {
    res.json(inbox(db));
  });
  app.post('/api/tracking/import', (req, res) => {
    res.json({ added: importInterval(db, trackingImportSchema.parse(req.body)) });
  });
  app.post('/api/tracking/ignore', (req, res) => {
    markInbox(db, trackingIgnoreSchema.parse(req.body), 'ignored');
    res.json({ ok: true });
  });
}
function ruleRoutes(app: Express, db: DatabaseSync): void {
  app.get('/api/tracking/rules', async (_req, res) => {
    res.json(await readRules(configuration(db)));
  });
  app.patch('/api/tracking/rules', async (req, res) => {
    const { rules } = trackingRulesWriteSchema.parse(req.body);
    res.json(await saveRules(configuration(db), rules));
  });
  app.post('/api/tracking/pause', async (req, res) => {
    const { paused } = z.object({ paused: z.boolean() }).parse(req.body);
    res.json(await pauseTracker(configuration(db), paused));
  });
}
export function registerTracking(app: Express, db: DatabaseSync): () => void {
  initializeTracking(db);
  setupWebTracking(db);
  backfillGroups(db);
  const controller = new TrackingController(db);
  connectionRoutes(app, controller);
  importRoutes(app, db);
  ruleRoutes(app, db);
  gameRoutes(app, db);
  const timer = setInterval(() => {
    void controller.sync();
  }, 5000);
  timer.unref();
  void controller.sync();
  return () => {
    clearInterval(timer);
  };
}

function gameRoutes(app: Express, db: DatabaseSync): void {
  app.post('/api/tracking/game-app', async (req, res) => {
    const input = gameApplicationSchema.parse(req.body),
      config = configuration(db);
    const rules = gameApplicationRules(await readRules(config), input);
    res.json(await saveRules(config, rules));
  });
}
