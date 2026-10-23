import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNavigation, navigationHash } from '../src/app/model/navigationState.js';
test('reload restores the selected page, date and calendar mode from the URL', () => {
  for (const page of ['games', 'analytics', 'settings', 'dashboard']) {
    const state = { page, date: '2026-10-20', view: 'week', display: 'list' };
    assert.deepEqual(readNavigation(navigationHash(state)), state);
  }
});
test('invalid saved navigation falls back to a valid screen and date', () => {
  assert.deepEqual(
    readNavigation('#page=wrong&date=2026-02-30&view=wrong&display=wrong', '2026-10-23'),
    { page: 'dashboard', date: '2026-10-23', view: 'day', display: 'timeline' },
  );
});
