import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runtimeFiles } from '../scripts/release/runtime-files.ts';
interface FixtureFile {
  file: string;
  content: string;
}
async function fixture(context: TestContext, files: FixtureFile[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'tng-package-test-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  for (const { file, content } of files) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}
void test('runtime package follows transitive and dynamic imports, including cycles', async (t) => {
  const root = await fixture(t, [
    { file: 'server/index.ts', content: "import './api.ts'; import('express');" },
    { file: 'server/api.ts', content: "import('../src/shared/value.ts');" },
    { file: 'src/shared/value.ts', content: "import '../../server/api.ts'; import './data.json';" },
    { file: 'src/shared/data.json', content: '{}' },
    { file: 'src/pages/private.ts', content: 'export const unused = true;' },
  ]);
  assert.deepEqual(
    runtimeFiles(root)
      .map((file) => file.replaceAll('\\', '/'))
      .sort(),
    ['server/api.ts', 'server/index.ts', 'src/shared/data.json', 'src/shared/value.ts'],
  );
});
void test('runtime package rejects a private file outside application directories', async (t) => {
  const root = await fixture(t, [
    { file: 'server/index.ts', content: "import '../data/private.json';" },
  ]);
  assert.throws(() => runtimeFiles(root), /outside application/);
});
void test('runtime package rejects unsupported local assets', async (t) => {
  const root = await fixture(t, [
    { file: 'server/index.ts', content: "import '../src/pages/App.vue';" },
  ]);
  assert.throws(() => runtimeFiles(root), /Unsupported runtime dependency/);
});
