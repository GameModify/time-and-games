import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
const lockSchema = z.object({
  packages: z.record(z.string(), z.object({ dev: z.boolean().optional() })),
});
function bundledFrontend(name: string): boolean {
  return /^node_modules\/(?:@vue\/|vue$|vue-router$|lucide-vue-next$)/.test(name);
}
async function licenseText(root: string, name: string): Promise<string> {
  const directory = path.join(root, name);
  const files = await readdir(directory);
  const file = files.find((item) => /^(licen[sc]e|copying)([.-].*)?$/i.test(item));
  if (!file) throw new Error('Missing dependency license: ' + name);
  return name + '\n' + (await readFile(path.join(directory, file), 'utf8'));
}
export async function writeNotices(root: string, target: string): Promise<void> {
  const lock = lockSchema.parse(
    JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8')),
  );
  const names = Object.entries(lock.packages)
    .filter(([name, item]) => name.startsWith('node_modules/') && (!item.dev || bundledFrontend(name)))
    .map(([name]) => name);
  const licenses = await Promise.all(names.map((name) => licenseText(root, name)));
  await writeFile(path.join(target, 'THIRD-PARTY-NOTICES.txt'), licenses.join('\n\n'));
}
