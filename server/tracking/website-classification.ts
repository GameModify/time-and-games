import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { websiteAssignmentSchema } from '../../src/shared/api/websiteContracts.ts';
import type { WebsiteAssignment } from '../../src/shared/api/websiteContracts.ts';
import type { TrackerRule } from '../../src/shared/api/trackingContracts.ts';
import { ensure } from '../http.ts';
import { configuration } from './storage.ts';
import { upsertRule, readRules } from './http.ts';
import { synchronizeWebsiteRules } from './website-rules.ts';
export function websiteRule(input: WebsiteAssignment): TrackerRule {
  return {
    id: randomUUID(),
    name: input.host,
    enabled: true,
    field: 'host',
    operator: 'equals',
    value: input.host,
    scope: 'focus',
    activity: 'tng:' + input.category_id,
    project: input.project || undefined,
    priority: 200,
  };
}
export async function classifyWebsite(db: DatabaseSync, input: WebsiteAssignment): Promise<number> {
  ensure(
    db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.category_id),
    'Категория не найдена',
  );
  const config = configuration(db);
  ensure(config.enabled && config.token, 'Подключи трекер для сохранения правила');
  await upsertRule(config, websiteRule(input));
  return synchronizeWebsiteRules(db, await readRules(config));
}
export function websiteClassificationRoutes(app: Express, db: DatabaseSync): void {
  app.post('/api/tracking/websites/classify', async (req, res) => {
    const changed = await classifyWebsite(db, websiteAssignmentSchema.parse(req.body));
    res.json({ ok: true, changed });
  });
}
