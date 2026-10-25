import { spawn, execFileSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { profileSchema } from '../../src/shared/api/profileContracts.ts';
const root = path.resolve(import.meta.dirname, '../..');
const launcher = 'Запустить Time & Games.bat';
interface Launch {
  child: ChildProcess;
  output: string;
}
function expand(file: string, directory: string): void {
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; Expand-Archive -LiteralPath $env:TNG_RELEASE_ZIP -DestinationPath $env:TNG_RELEASE_TEST -Force',
    ],
    { env: { ...process.env, TNG_RELEASE_ZIP: file, TNG_RELEASE_TEST: directory }, stdio: 'inherit' },
  );
}
function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('No test port'));
        return;
      }
      server.close(() => {
        resolve(address.port);
      });
    });
  });
}
function start(folder: string, port: number, offline: boolean): Launch {
  const child = spawn('cmd.exe', ['/d', '/c', 'call "' + launcher + '"'], {
    cwd: folder,
    windowsHide: true,
    windowsVerbatimArguments: true,
    env: environment(folder, port, offline),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const launch: Launch = { child, output: '' };
  const collect = (chunk: Buffer) => {
    launch.output = (launch.output + chunk.toString()).slice(-12000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return launch;
}
async function ready(launch: Launch, base: string): Promise<void> {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    if (launch.child.exitCode !== null) throw new Error('Release exited: ' + launch.output);
    try {
      if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(500) })).ok) return;
    } catch {
      /* Dependencies may still be installing on the first launch. */
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 250);
    });
  }
  throw new Error('Release startup timed out: ' + launch.output);
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  assert.ok(child.pid);
  const exited = once(child, 'exit');
  execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  await exited;
}
async function routes(base: string): Promise<void> {
  for (const route of ['/', '/games', '/media', '/statistics', '/settings']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    const source = await response.text();
    assert.match(source, /<div id="app"><\/div>/);
    const script = /src="(\/assets\/[^"]+\.js)"/.exec(source)?.[1];
    assert.ok(script, 'Missing built UI script');
    assert.equal((await fetch(base + script)).status, 200);
  }
}
async function profile(base: string, first: boolean): Promise<void> {
  const expected = { name: 'Release check', avatar: '' };
  const request = first
    ? {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expected),
      }
    : {};
  const response = await fetch(base + '/api/profile', request);
  assert.equal(response.status, 200);
  assert.deepEqual(profileSchema.parse(await response.json()), expected);
}
async function run(folder: string, first: boolean): Promise<void> {
  const port = await unusedPort(),
    base = 'http://127.0.0.1:' + String(port);
  const launch = start(folder, port, !first);
  try {
    await ready(launch, base);
    await routes(base);
    await profile(base, first);
    assert.equal(existsSync(path.join(folder, 'node_modules/vite')), false);
    assert.ok(existsSync(path.join(folder, 'data/time-and-games.sqlite')));
  } finally {
    await stop(launch.child);
  }
}
async function verify(directory: string): Promise<void> {
  const { version } = z
    .object({ version: z.string() })
    .parse(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')));
  expand(path.join(root, 'dist/releases/TimeAndGames-' + version + '.zip'), directory);
  const folder = path.join(directory, 'TimeAndGames');
  for (const name of ['.env', '.git', 'data/activity.sqlite', 'data/time-and-games.sqlite'])
    assert.equal(existsSync(path.join(folder, name)), false, 'Private data in release: ' + name);
  assert.ok(existsSync(path.join(folder, 'release.json')));
  await run(folder, true);
  await run(folder, false);
  console.log(
    'Release ZIP: clean launch, built routes, production dependencies and offline restart passed',
  );
}
if (process.platform !== 'win32') throw new Error('Windows launcher smoke test requires Windows');
const temporary = await mkdtemp(path.join(tmpdir(), 'tng-release-smoke-'));
try {
  await verify(temporary);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function environment(folder: string, port: number, offline: boolean): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TNG_PORT: String(port),
    TNG_LAN_HOST: '',
    TNG_DATA_DIR: path.join(folder, 'data'),
    TNG_NO_BROWSER: '1',
    npm_config_offline: offline ? 'true' : 'false',
  };
}
