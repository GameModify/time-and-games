import type { Request } from 'express';
export class HttpFailure extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new HttpFailure(message, status);
}
interface RequestRejection {
  status: number;
  message: string;
}
const allowedOrigins = new Set([
  'http://127.0.0.1:3535',
  'http://localhost:3535',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  `http://127.0.0.1:${process.env.TNG_PORT ?? '3535'}`,
]);
export function requestRejection(req: Request): RequestRejection | undefined {
  if (!['127.0.0.1', 'localhost'].includes(req.hostname))
    return { status: 403, message: 'Только локальный доступ' };
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin))
    return { status: 403, message: 'Запрос с другого сайта запрещён' };
  if (
    ['POST', 'PATCH', 'DELETE'].includes(req.method) &&
    req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json'
  )
    return { status: 415, message: 'Используй Content-Type: application/json' };
  return undefined;
}
