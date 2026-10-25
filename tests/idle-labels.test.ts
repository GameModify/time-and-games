import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idleMinutes, idleTimeout, inactivityMessage } from '../src/shared/lib/trackingIdle.ts';
import { trackingPreferencesSchema, trackerStatusSchema } from '../src/shared/api/trackingContracts.ts';
void test('inactivity text uses Russian minute forms and the advertised tracker policy', () => {
  assert.deepEqual(
    [1, 2, 5, 21].map((n) => idleMinutes(n * 60000)),
    ['1 минута', '2 минуты', '5 минут', '21 минута'],
  );
  assert.equal(idleTimeout(null), 300000);
  const status = trackerStatusSchema.parse({
    api_version: 1,
    device_id: crypto.randomUUID(),
    paused: false,
    desktop_available: true,
    desktop_error: false,
    desktop_at: null,
    browser_at: null,
    idle_timeout_ms: 120000,
  });
  assert.equal(idleTimeout(status), 120000);
  assert.equal(inactivityMessage(status), '2 минуты без действий, учёт приостановлен');
});
void test('inactivity preferences only accept one through thirty whole minutes', () => {
  for (const value of [60000, 120000, 1800000])
    assert.ok(trackingPreferencesSchema.safeParse({ idle_timeout_ms: value }).success);
  for (const value of [0, 90000, 1860000])
    assert.equal(trackingPreferencesSchema.safeParse({ idle_timeout_ms: value }).success, false);
});
