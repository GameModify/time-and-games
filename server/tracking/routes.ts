import type { TrackingConnection } from '../../src/shared/api/trackingContracts.ts';
import { synchronizeWebsiteRules } from './website-rules.ts';
import { websiteClassificationRoutes } from './website-classification.ts';
import { setupYouTube } from './youtube-setup.ts';
import { classificationRoutes } from './classification.ts';
import { setupWebTracking } from './web-setup.ts';
import { gameApplicationRules } from './game-app.ts';
import { gameApplicationSchema } from '../../src/shared/api/trackingContracts.ts';
import { backfillGroups } from './backfill.ts';
import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import {
  trackingPreferencesSchema,
  trackingConnectionSchema,
  trackingImportSchema,
  trackingIgnoreSchema,
  trackingRulesWriteSchema,
} from '../../src/shared/api/trackingContracts.ts';
import { ensure } from '../http.ts';
import { TrackingController } from './controller.ts';
import { configuration, initializeTracking, inbox, markInbox, updateConfiguration } from './storage.ts';
import { savePreferences, pauseTracker, readRules, saveRules, validateEndpoint } from './http.ts';
import { importInterval } from './import.ts';
function connectionRoutes(app: Express, controller: TrackingController): void {
  app.get('/api/tracking', (_req, res) => {
    res.json(controller.state());
  });
  app.patch('/api/tracking', async (req, res) => {
    const input = trackingConnectionSchema.parse(req.body);
    await saveConnection(controller, input);
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
function ruleRoutes(app: Express, controller: TrackingController): void {
  const db = controller.db;
  websiteClassificationRoutes(app, db);
  preferenceRoutes(app, controller);
  app.get('/api/tracking/rules', async (_req, res) => {
    res.json(await readRules(configuration(db)));
  });
  app.patch('/api/tracking/rules', async (req, res) => {
    const { rules } = trackingRulesWriteSchema.parse(req.body);
    const result = await saveRules(configuration(db), rules);
    const changed = synchronizeWebsiteRules(db, rules);
    res.json({ ...result, changed });
  });
  app.post('/api/tracking/pause', async (req, res) => {
    const { paused } = z.object({ paused: z.boolean() }).parse(req.body);
    res.json(await pauseTracker(configuration(db), paused));
  });
}
export function registerTracking(app: Express, db: DatabaseSync): () => void {
  initializeTracking(db);
  setupWebTracking(db);
  setupYouTube(db);
  backfillGroups(db);
  const controller = new TrackingController(db);
  connectionRoutes(app, controller);
  importRoutes(app, db);
  ruleRoutes(app, controller);
  gameRoutes(app, db);
  classificationRoutes(app, db);
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

function preferenceRoutes(app: Express, controller: TrackingController): void {
  app.post('/api/tracking/preferences', async (req, res) => {
    const input = trackingPreferencesSchema.parse(req.body);
    const result = await savePreferences(configuration(controller.db), input);
    await controller.sync();
    res.json(result);
  });
}

async function saveConnection(controller: TrackingController, input: TrackingConnection): Promise<void> {
  const db = controller.db;
  validateEndpoint(input.endpoint);
  ensure(!controller.syncing, 'Подожди окончания синхронизации', 409);
  ensure(!input.enabled || Boolean(input.token ?? configuration(db).token), 'Укажи ключ подключения');
  updateConfiguration(db, input);
  controller.websitesLoaded = false;
  setupWebTracking(db);
  setupYouTube(db);
  await controller.sync();
}
