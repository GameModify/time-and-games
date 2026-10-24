import type { ZodType } from 'zod';
import { z } from 'zod';
import {
  trackerPageSchema,
  trackerStatusSchema,
  trackerRuleSchema,
} from '../../src/shared/api/trackingContracts.ts';
import type { TrackerRule } from '../../src/shared/api/trackingContracts.ts';
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
  body?: { paused: boolean } | TrackerRule[],
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
