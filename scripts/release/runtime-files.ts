import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
function dependencyPath(root: string, file: string, specifier: string): string {
  const target = path.resolve(path.dirname(file), specifier);
  const relative = path.relative(root, target);
  if (!/^(server|src)[\\/]/.test(relative))
    throw new Error('Runtime dependency outside application: ' + relative);
  if (!['.ts', '.json'].includes(path.extname(target)))
    throw new Error('Unsupported runtime dependency: ' + relative);
  return target;
}
function localDependencies(root: string, file: string): string[] {
  if (path.extname(file) === '.json') return [];
  const result = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
  return result.importedFiles
    .filter((item) => item.fileName.startsWith('.'))
    .map((item) => dependencyPath(root, file, item.fileName));
}
export function runtimeFiles(root: string): string[] {
  const pending = [path.join(root, 'server/index.ts')],
    files = new Set<string>();
  while (pending.length) {
    const file = pending.pop();
    if (!file || files.has(file)) continue;
    files.add(file);
    pending.push(...localDependencies(root, file));
  }
  return [...files].map((file) => path.relative(root, file));
}
