import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
const manifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean(),
  type: z.literal('module'),
  description: z.string(),
  engines: z.object({ node: z.string() }),
  dependencies: z.record(z.string(), z.string()),
});
const lockSchema = z.object({
  packages: z.record(z.string(), z.object({ version: z.string().optional() })),
});
async function readVersions(file: string) {
  return lockSchema.parse(JSON.parse(await readFile(file, 'utf8'))).packages;
}
export async function writeRuntimeManifest(root: string, target: string): Promise<void> {
  const source = manifestSchema.parse(
    JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')),
  );
  const manifest = { ...source, scripts: { start: 'node server/index.ts' } };
  await writeFile(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  pruneLockfile(root, target);
  await checkVersions(root, target);
}
function pruneLockfile(root: string, target: string): void {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'scripts/npm.ts'),
      'prune',
      '--omit=dev',
      '--package-lock-only',
      '--ignore-scripts',
      '--offline',
      '--cache',
      path.join(root, '.npm-cache'),
    ],
    { cwd: target, stdio: 'inherit' },
  );
}
async function checkVersions(root: string, target: string): Promise<void> {
  const before = await readVersions(path.join(root, 'package-lock.json'));
  const after = await readVersions(path.join(target, 'package-lock.json'));
  for (const [name, item] of Object.entries(after))
    if (item.version !== before[name]?.version)
      throw new Error('Runtime dependency version changed: ' + name);
}
