import { classifyWebsite } from './website-classification.ts';
import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { classificationSchema } from '../../src/shared/api/trackingContracts.ts';
import type { Classification, TrackerRule } from '../../src/shared/api/trackingContracts.ts';
import { sessionSchema } from '../../src/shared/api/contracts.ts';
import type { Session, SessionContext } from '../../src/shared/api/contracts.ts';
import { readRow, transaction } from '../storage.ts';
import { saveSessionContext, withSessionContext } from '../session-context.ts';
import { ensure } from '../http.ts';
import { upsertRule } from './http.ts';
import { configuration } from './storage.ts';
function subject(scope: Classification['scope'], context?: SessionContext) {
  if (scope === 'video')
    return { field: 'media_id' as const, value: context?.media_id, kind: 'media' as const };
  if (scope === 'channel')
    return { field: 'media_creator' as const, value: context?.media_creator, kind: 'media' as const };
  if (scope === 'app') return { field: 'app' as const, value: context?.app, kind: 'focus' as const };
  return { field: 'host' as const, value: context?.website, kind: 'focus' as const };
}
function ruleDefaults(input: Classification) {
  return {
    enabled: true,
    operator: 'equals' as const,
    activity: 'tng:' + input.category_id,
    project: input.project || undefined,
    priority: input.scope === 'video' ? 600 : input.scope === 'channel' ? 500 : 200,
  };
}
function previousRule(rules: TrackerRule[], target: ReturnType<typeof subject>) {
  return rules.find(
    (rule) =>
      rule.field === target.field &&
      rule.operator === 'equals' &&
      rule.scope === target.kind &&
      (target.field === 'media_id'
        ? rule.value === target.value
        : rule.value.toLocaleLowerCase() === target.value?.toLocaleLowerCase()),
  );
}
export function classificationRule(
  input: Classification,
  session: Session,
  rules: TrackerRule[],
): TrackerRule {
  const target = subject(input.scope, session.tracking_context);
  ensure(input.scope !== 'record' && target.value, 'Для такого правила нет данных источника');
  const old = previousRule(rules, target);
  return {
    ...ruleDefaults(input),
    id: old?.id ?? randomUUID(),
    name: target.value.slice(0, 100),
    field: target.field,
    value: target.value,
    scope: target.kind,
  };
}
function selectedSession(db: DatabaseSync, input: Classification): Session {
  ensure(
    db.prepare('SELECT 1 FROM categories WHERE id=?').get(input.category_id),
    'Категория не найдена',
  );
  const row = readRow(db, 'SELECT * FROM sessions WHERE id=?', sessionSchema, [input.session_id]);
  ensure(row, 'Запись не найдена или ещё не завершена', 404);
  ensure(row.end_at !== null, 'Сначала заверши запись');
  const session = withSessionContext(db, [row])[0];
  ensure(session, 'Запись не найдена', 404);
  return session;
}
async function remember(db: DatabaseSync, input: Classification, session: Session): Promise<void> {
  if (input.scope === 'record') return;
  const config = configuration(db);
  ensure(config.enabled && config.token, 'Подключи трекер для сохранения правила');
  await upsertRule(config, classificationRule(input, session, []));
}
export async function classifySession(db: DatabaseSync, input: Classification): Promise<void> {
  const session = selectedSession(db, input);
  if (input.scope === 'site' && session.tracking_context?.website) {
    await classifyWebsite(db, {
      host: session.tracking_context.website,
      category_id: input.category_id,
      project: input.project,
    });
    return;
  }
  await remember(db, input, session);
  transaction(db, () => {
    db.prepare('UPDATE sessions SET category_id=? WHERE id=?').run(input.category_id, input.session_id);
    saveSessionContext(db, {
      id: session.id,
      tracking_context: { ...session.tracking_context, project: input.project || undefined },
    });
  });
}
export function classificationRoutes(app: Express, db: DatabaseSync): void {
  app.post('/api/tracking/classify', async (req, res) => {
    await classifySession(db, classificationSchema.parse(req.body));
    res.json({ ok: true });
  });
}
