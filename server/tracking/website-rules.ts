import type { DatabaseSync } from 'node:sqlite';
import type { TrackerRule, TrackerInterval } from '../../src/shared/api/trackingContracts.ts';
import { websiteAssignmentSchema } from '../../src/shared/api/websiteContracts.ts';
import type { WebsiteAssignment } from '../../src/shared/api/websiteContracts.ts';
import { configuration, saveConfiguration } from './storage.ts';
import { transaction } from '../storage.ts';
import { initializeSessionContext } from '../session-context.ts';
function assignment(db: DatabaseSync, rule: TrackerRule): WebsiteAssignment | undefined {
  if (!rule.enabled || rule.field !== 'host' || rule.operator !== 'equals' || rule.scope !== 'focus')
    return undefined;
  const config = configuration(db);
  const category = rule.activity.startsWith('tng:')
    ? rule.activity.slice(4)
    : config.mappings.find((mapping) => mapping.activity === rule.activity)?.category_id;
  if (!category || !db.prepare('SELECT 1 FROM categories WHERE id=?').get(category)) return undefined;
  return websiteAssignmentSchema.safeParse({
    host: rule.value,
    category_id: category,
    project: rule.project,
  }).data;
}
function assignments(db: DatabaseSync, rules: TrackerRule[]): WebsiteAssignment[] {
  const hosts = new Map<string, WebsiteAssignment>();
  const ordered = rules.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const rule of ordered) {
    const item = assignment(db, rule);
    if (item && !hosts.has(item.host)) hosts.set(item.host, item);
  }
  return [...hosts.values()];
}
function recategorize(db: DatabaseSync, item: WebsiteAssignment): number {
  const target =
    'SELECT c.session_id FROM session_context c JOIN sessions s ON s.id=c.session_id WHERE lower(c.website)=? AND c.media_id IS NULL AND c.media_creator IS NULL AND s.end_at IS NOT NULL';
  const result = db
    .prepare('UPDATE sessions SET category_id=? WHERE id IN (' + target + ')')
    .run(item.category_id, item.host);
  db.prepare('UPDATE session_context SET project=? WHERE session_id IN (' + target + ')').run(
    item.project || null,
    item.host,
  );
  return Number(result.changes);
}
export function synchronizeWebsiteRules(db: DatabaseSync, rules: TrackerRule[]): number {
  initializeSessionContext(db);
  const values = assignments(db, rules);
  return transaction(db, () => {
    let changed = 0;
    for (const item of values) changed += recategorize(db, item);
    saveConfiguration(db, { ...configuration(db), website_rules: values });
    return changed;
  });
}
export function websiteInterval<T extends TrackerInterval>(db: DatabaseSync, item: T): T {
  if (!item.website || item.media_id || item.media_creator) return item;
  const rule = configuration(db).website_rules.find(
    (entry) => entry.host === item.website?.toLowerCase(),
  );
  if (!rule || !db.prepare('SELECT 1 FROM categories WHERE id=?').get(rule.category_id)) return item;
  return { ...item, activity: 'tng:' + rule.category_id, project: rule.project || undefined };
}
