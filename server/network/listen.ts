import type { Express } from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { NetworkConfiguration } from './configuration.ts';

export function listenNetwork(api: Express, config: NetworkConfiguration): Server[] {
  const hosts = ['127.0.0.1', ...(config.lanHost ? [config.lanHost] : [])];
  return hosts.map((host) => {
    const server = api.listen(config.port, host, () => {
      const address = server.address() as AddressInfo;
      console.log(`Time & Games running at http://${host}:${address.port}`);
    });
    return server;
  });
}
export function closeNetwork(servers: Server[], done: () => void): void {
  let remaining = servers.length;
  for (const server of servers) {
    server.close(() => {
      remaining--;
      if (remaining === 0) done();
    });
  }
}
