import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkRejection } from '../server/network/access.ts';
import type { NetworkRequest } from '../server/network/access.ts';
import { parseNetworkConfiguration, privateAddress } from '../server/network/configuration.ts';
const local = parseNetworkConfiguration({});
const lan = parseNetworkConfiguration({ TNG_LAN_HOST: '192.168.1.10' });
const request: NetworkRequest = {
  hostname: '192.168.1.10',
  origin: 'http://192.168.1.10:3535',
  remoteAddress: '192.168.1.20',
  localPort: 3535,
};
void test('network access is loopback-only unless a specific private address is configured', () => {
  assert.equal(local.port, 3535);
  assert.equal(local.lanHost, undefined);
  assert.equal(networkRejection(request, local)?.status, 403);
  assert.equal(networkRejection(request, lan), undefined);
  assert.equal(
    networkRejection({ hostname: 'localhost', remoteAddress: '127.0.0.1' }, local),
    undefined,
  );
  assert.equal(networkRejection({ ...request, hostname: '192.168.1.11' }, lan)?.status, 403);
});
void test('network configuration rejects public, wildcard and malformed listening addresses', () => {
  for (const address of ['0.0.0.0', '8.8.8.8', '127.0.0.1', '::', 'example.com', '192.168.1.999'])
    assert.throws(() => parseNetworkConfiguration({ TNG_LAN_HOST: address }));
  for (const port of ['-1', '65536', 'wrong'])
    assert.throws(() => parseNetworkConfiguration({ TNG_PORT: port }));
  assert.equal(parseNetworkConfiguration({ TNG_LAN_HOST: '', TNG_PORT: '0' }).lanHost, undefined);
});
void test('private addresses follow the RFC1918 boundaries', () => {
  for (const address of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.255.254'])
    assert.equal(privateAddress(address), true);
  for (const address of ['172.15.255.255', '172.32.0.1', '192.169.0.1', '100.64.0.1', '::1'])
    assert.equal(privateAddress(address), false);
});
void test('LAN mode still rejects public clients and hostile Host headers', () => {
  for (const remoteAddress of ['8.8.8.8', '100.64.0.1', '2001:db8::1', ''])
    assert.equal(networkRejection({ ...request, remoteAddress }, lan)?.status, 403);
  for (const hostname of ['evil.example', '192.168.1.10.evil.example', '0.0.0.0'])
    assert.equal(networkRejection({ ...request, hostname }, lan)?.status, 403);
});
void test('LAN origins must match the configured address, scheme and listening port', () => {
  const origins = [
    'https://evil.example',
    'http://192.168.1.11:3535',
    'http://192.168.1.10:3536',
    'https://192.168.1.10:3535',
    'null',
    'http://192.168.1.10:3535.evil.example',
  ];
  for (const origin of origins) assert.equal(networkRejection({ ...request, origin }, lan)?.status, 403);
  assert.equal(networkRejection({ ...request, origin: undefined }, lan), undefined);
  assert.equal(networkRejection({ ...request, origin: 'http://localhost:5173' }, lan), undefined);
  assert.equal(
    networkRejection({ ...request, localPort: 4000, origin: 'http://192.168.1.10:4000' }, lan),
    undefined,
  );
});
