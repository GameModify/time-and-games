import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { initializeTimers } from './storage.ts';
import { pauseTimer, resumeTimer, finishPausedTimer } from './commands.ts';
export function registerTimers(app: Express, db: DatabaseSync): void {
  initializeTimers(db);
  app.post('/api/sessions/:id/pause', (req, res) => {
    res.json(pauseTimer(db, req.params.id));
  });
  app.post('/api/timers/:id/resume', (req, res) => {
    res.json(resumeTimer(db, req.params.id));
  });
  app.post('/api/timers/:id/finish', (req, res) => {
    finishPausedTimer(db, req.params.id);
    res.json({ ok: true });
  });
}
