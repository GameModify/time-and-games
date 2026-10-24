import { z } from 'zod';
import type {
  Classification,
  GameApplication,
  TrackingConnection,
  TrackingImport,
  TrackingIgnore,
  TrackingRulesWrite,
} from './trackingContracts.ts';
import type { ZodType } from 'zod';
import type { Backup, DashboardCards } from './contracts.ts';
import type { MediaInput } from './mediaContracts.ts';
import type {
  SessionWriteDto,
  CategoryWriteDto,
  GameWriteDto,
  SettingsWriteDto,
} from './inputContracts.ts';
export type WriteDto =
  | DashboardCards
  | Classification
  | SessionWriteDto
  | CategoryWriteDto
  | GameWriteDto
  | SettingsWriteDto
  | MediaInput
  | Backup
  | GameApplication
  | TrackingConnection
  | TrackingImport
  | TrackingIgnore
  | TrackingRulesWrite
  | { paused: boolean };
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
interface ApiRequest {
  path: string;
  method: HttpMethod;
  body?: WriteDto;
}
const errorSchema = z.object({ error: z.string() });
async function requestData(request: ApiRequest): Promise<unknown> {
  const response = await fetch(`/api${request.path}`, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(errorSchema.safeParse(data).data?.error ?? 'Не удалось выполнить запрос');
  return data;
}
export async function api(path: string, method: HttpMethod = 'GET', body?: WriteDto): Promise<void> {
  await requestData({ path, method, body });
}
export async function readApi<T>(
  path: string,
  schema: ZodType<T>,
  method: HttpMethod = 'GET',
  body?: WriteDto,
): Promise<T> {
  return schema.parse(await requestData({ path, method, body }));
}
