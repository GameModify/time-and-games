import { isIP } from 'node:net';
import { z } from 'zod';

export function privateAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [first, second] = address.split('.').map(Number);
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
const networkSchema = z.object({
  port: z.coerce.number().int().min(0).max(65535).default(3535),
  lanHost: z.string().refine(privateAddress, 'Укажи частный IPv4-адрес домашней сети').optional(),
});
export type NetworkConfiguration = z.infer<typeof networkSchema>;
export interface NetworkEnvironment {
  TNG_PORT?: string;
  TNG_LAN_HOST?: string;
}
export function parseNetworkConfiguration(environment: NetworkEnvironment): NetworkConfiguration {
  return networkSchema.parse({
    port: environment.TNG_PORT,
    lanHost: environment.TNG_LAN_HOST || undefined,
  });
}
