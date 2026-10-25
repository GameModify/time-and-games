import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const root = path.resolve(import.meta.dirname, '../..');
const manifest = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });
function git(args: string[]): string {
  return execFileSync('git', ['-c', 'safe.directory=' + root, ...args], { cwd: root, encoding: 'utf8' });
}
function sourceFiles(): string[] {
  return git(['ls-files', '-z'])
    .split('\0')
    .filter(
      (file) =>
        Boolean(file) &&
        !/^(?:data|\.github|\.qa|node_modules|dist)\//.test(file) &&
        file !== '.env' &&
        file !== 'AGENTS.md',
    );
}
async function stageSource(target: string): Promise<void> {
  for (const file of sourceFiles()) {
    const destination = path.join(target, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(root, file), destination);
  }
  await mkdir(path.join(target, 'dist'), { recursive: true });
  for (const file of ['index.html', 'assets', 'favicon.svg'])
    await cp(path.join(root, 'dist', file), path.join(target, 'dist', file), { recursive: true });
}
function archive(directory: string, destination: string): void {
  if (process.platform !== 'win32') throw new Error('Release ZIP packaging requires Windows');
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; Compress-Archive -LiteralPath $env:TNG_PACKAGE_STAGE -DestinationPath $env:TNG_PACKAGE_ZIP -Force',
    ],
    {
      env: { ...process.env, TNG_PACKAGE_STAGE: directory, TNG_PACKAGE_ZIP: destination },
      stdio: 'inherit',
    },
  );
}
async function packageRelease(temporary: string): Promise<void> {
  const { version } = manifest.parse(
    JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')),
  );
  const stage = path.join(temporary, 'TimeAndGames');
  await mkdir(stage);
  await stageSource(stage);
  await writeFile(
    path.join(stage, 'release.json'),
    JSON.stringify({ version, commit: git(['rev-parse', 'HEAD']).trim() }),
  );
  const output = path.join(root, 'dist/releases');
  await mkdir(output, { recursive: true });
  const file = path.join(output, 'TimeAndGames-' + version + '.zip');
  archive(stage, file);
  await checksum(file, output);
  console.log('Release package: ' + file);
}
const temporary = await mkdtemp(path.join(tmpdir(), 'tng-release-'));
try {
  await packageRelease(temporary);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function checksum(file: string, output: string): Promise<void> {
  const sum = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  await writeFile(path.join(output, 'SHA256SUMS.txt'), sum + '  ' + path.basename(file) + '\n');
}
