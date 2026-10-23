import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const order = ['shared', 'entities', 'features', 'pages', 'app'];
const failures = [];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.(js|vue)$/.test(entry.name) ? [full] : [];
  });
}
for (const file of walk(root)) {
  const current = path.relative(root, file).split(path.sep);
  if (!order.includes(current[0])) continue;
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target = path.relative(root, path.resolve(path.dirname(file), match[1])).split(path.sep);
    if (!order.includes(target[0])) continue;
    const sameSlice = current[0] === target[0] && current[1] === target[1];
    if (order.indexOf(target[0]) > order.indexOf(current[0]))
      failures.push(`${path.relative(root, file)}: upward dependency ${match[1]}`);
    if (current[0] === target[0] && !['app', 'shared'].includes(current[0]) && !sameSlice)
      failures.push(`${path.relative(root, file)}: cross-slice dependency ${match[1]}`);
    if (
      !sameSlice &&
      ['pages', 'features', 'entities'].includes(target[0]) &&
      target.at(-1) !== 'index.js'
    )
      failures.push(`${path.relative(root, file)}: use public index.js for ${match[1]}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Architecture boundaries: OK');
