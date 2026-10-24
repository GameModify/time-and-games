import { privateAddress } from './configuration.ts';
import type { NetworkConfiguration } from './configuration.ts';
export interface NetworkRequest {
  hostname: string;
  origin?: string;
  remoteAddress?: string;
  localPort?: number;
}
export interface RequestRejection {
  status: number;
  message: string;
}
function localClient(address: string): boolean {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}
function allowedOrigins(config: NetworkConfiguration, port: number): string[] {
  const hosts = ['127.0.0.1', 'localhost', ...(config.lanHost ? [config.lanHost] : [])];
  return hosts
    .map((host) => `http://${host}:${port}`)
    .concat(['http://127.0.0.1:5173', 'http://localhost:5173']);
}
export function networkRejection(
  request: NetworkRequest,
  config: NetworkConfiguration,
): RequestRejection | undefined {
  const hosts = ['127.0.0.1', 'localhost', ...(config.lanHost ? [config.lanHost] : [])];
  if (!hosts.includes(request.hostname)) return { status: 403, message: 'Адрес сайта не разрешён' };
  const client = request.remoteAddress ?? '';
  if (!localClient(client) && !(config.lanHost && privateAddress(client)))
    return { status: 403, message: 'Доступ разрешён только из локальной сети' };
  if (
    request.origin &&
    !allowedOrigins(config, request.localPort ?? config.port).includes(request.origin)
  )
    return { status: 403, message: 'Запрос с другого сайта запрещён' };
  return undefined;
}
