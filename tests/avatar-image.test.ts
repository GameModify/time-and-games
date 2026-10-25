import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avatarImage } from '../src/pages/settings/model/avatarImage.ts';
void test('avatar upload rejects unsupported types and large files before decoding', async () => {
  await assert.rejects(
    avatarImage(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })),
    /JPG, PNG или WebP/,
  );
  const large = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
  await assert.rejects(avatarImage(large), /5 МБ/);
});
