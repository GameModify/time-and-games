import type { Request } from 'express';
import { networkRejection } from './network/access.ts';
import type { RequestRejection } from './network/access.ts';
import { network } from './network/environment.ts';
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
export function requestRejection(req: Request): RequestRejection | undefined {
  const rejection = networkRejection(
    {
      hostname: req.hostname,
      origin: req.headers.origin,
      remoteAddress: req.socket.remoteAddress,
      localPort: req.socket.localPort,
    },
    network,
  );
  if (rejection) return rejection;
  if (
    ['POST', 'PATCH', 'DELETE'].includes(req.method) &&
    req.headers['content-type']?.split(';')[0]?.trim() !== 'application/json'
  )
    return { status: 415, message: 'Используй Content-Type: application/json' };
  return undefined;
}
