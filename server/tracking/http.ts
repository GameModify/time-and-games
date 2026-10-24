import type { ZodType } from 'zod';
import { z } from 'zod';
import {
  trackerPageSchema,
  trackerStatusSchema,
  trackerRuleSchema,
} from '../../src/shared/api/trackingContracts.ts';
import type { ContentLabel, TrackerRule } from '../../src/shared/api/trackingContracts.ts';
import type { TrackingConfiguration } from './storage.ts';
import { ensure } from '../http.ts';
export function validateEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  ensure(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash,
    'Укажи локальный адрес: http://127.0.0.1:3536',
  );
  return url.origin;
}
function responseOk(response: Response): void {
  ensure(
    response.ok,
    response.status === 401 ? 'Неверный ключ подключения трекера' : 'Трекер отклонил запрос',
    502,
  );
}
async function request<T>(
  config: TrackingConfiguration,
  route: string,
  schema: ZodType<T>,
  body?: { paused: boolean } | TrackerRule[] | ContentLabel[],
): Promise<T> {
  const response = await fetch(validateEndpoint(config.endpoint) + '/v1' + route, {
    method: body === undefined ? 'GET' : Array.isArray(body) ? 'PUT' : 'POST',
    headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(2500),
    redirect: 'error',
  });
  responseOk(response);
  const data: unknown = await response.json();
  return schema.parse(data);
}
export const readStatus = (config: TrackingConfiguration) =>
  request(config, '/status', trackerStatusSchema);
export const readPage = (config: TrackingConfiguration) =>
  request(config, '/intervals?cursor=' + String(config.cursor), trackerPageSchema);
export const readRules = (config: TrackingConfiguration) =>
  request(config, '/rules', trackerRuleSchema.array());
export const saveRules = (config: TrackingConfiguration, rules: TrackerRule[]) =>
  request(config, '/rules', z.object({ ok: z.literal(true) }), rules);
export const pauseTracker = (config: TrackingConfiguration, paused: boolean) =>
  request(config, '/pause', trackerStatusSchema, { paused });

export const publishLabels = (config: TrackingConfiguration, labels: ContentLabel[]) =>
  request(config, '/content-labels', z.object({ ok: z.literal(true) }), labels);

interface RuleSnapshot {
  rules: TrackerRule[];
  tag: string;
}
async function snapshot(config: TrackingConfiguration): Promise<RuleSnapshot> {
  const response = await fetch(validateEndpoint(config.endpoint) + '/v1/rules', {
    headers: { Authorization: 'Bearer ' + config.token },
    signal: AbortSignal.timeout(2500),
    redirect: 'error',
  });
  ensure(response.ok, 'Трекер не вернул правила', 502);
  const tag = response.headers.get('etag');
  ensure(
    tag && /^"[a-f0-9]{64}"$/.test(tag),
    'Обнови Activity Tracker для безопасного сохранения правил',
    502,
  );
  return { rules: trackerRuleSchema.array().parse(await response.json()), tag };
}
function sameTarget(rule: TrackerRule, input: TrackerRule): boolean {
  const sameValue =
    rule.field === 'media_id'
      ? rule.value === input.value
      : rule.value.toLocaleLowerCase() === input.value.toLocaleLowerCase();
  return (
    rule.id === input.id ||
    (sameValue &&
      rule.field === input.field &&
      rule.scope === input.scope &&
      rule.operator === input.operator)
  );
}
function merged(rules: TrackerRule[], input: TrackerRule): TrackerRule[] {
  const old = rules.find((rule) => sameTarget(rule, input));
  const others = rules.filter((rule) => !sameTarget(rule, input));
  ensure(others.length < 200, 'Достигнут предел правил');
  return [...others, { ...input, id: old?.id ?? input.id }];
}
async function write(config: TrackingConfiguration, value: RuleSnapshot): Promise<boolean> {
  const response = await fetch(validateEndpoint(config.endpoint) + '/v1/rules', {
    method: 'PUT',
    body: JSON.stringify(value.rules),
    headers: {
      Authorization: 'Bearer ' + config.token,
      'Content-Type': 'application/json',
      'If-Match': value.tag,
    },
    signal: AbortSignal.timeout(2500),
    redirect: 'error',
  });
  if (response.status === 409) return false;
  ensure(response.ok, 'Трекер не сохранил правило', 502);
  return true;
}
export async function upsertRule(config: TrackingConfiguration, rule: TrackerRule): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await snapshot(config);
    if (await write(config, { ...current, rules: merged(current.rules, rule) })) return;
  }
  throw new Error('Правила меняются одновременно. Повтори сохранение.');
}
