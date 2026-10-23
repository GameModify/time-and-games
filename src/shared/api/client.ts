import type { ZodType } from 'zod';
export async function api(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: unknown = await res.json();
  if (!res.ok)
    throw new Error(
      typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Не удалось выполнить запрос',
    );
  return data;
}
export async function readApi<T>(path: string, schema: ZodType<T>): Promise<T> {
  return schema.parse(await api(path));
}
