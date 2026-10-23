import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNavigation, navigationUrl, pagePaths } from '../src/shared/lib/navigationState.ts';
import type { NavigationState } from '../src/shared/lib/navigationState.ts';
const today = '2026-10-23';
const defaults: NavigationState = { page: 'dashboard', date: today, view: 'day', display: 'timeline' };
void test('screen URLs omit irrelevant parameters and default calendar values', () => {
  for (const page of ['dashboard', 'games', 'media', 'analytics', 'settings'] as const) {
    assert.equal(navigationUrl({ ...defaults, page }, today), pagePaths[page]);
    assert.equal(readNavigation(pagePaths[page], today).page, page);
  }
  assert.equal(
    navigationUrl(
      { ...defaults, page: 'settings', date: '2026-10-20', view: 'week', display: 'list' },
      today,
    ),
    '/settings',
  );
  assert.equal(
    navigationUrl(
      { ...defaults, page: 'games', date: '2026-10-20', view: 'week', display: 'list' },
      today,
    ),
    '/games',
  );
});
void test('reload preserves a non-default calendar period and display', () => {
  for (const page of ['dashboard', 'analytics'] as const) {
    const state: NavigationState = { page, date: '2026-10-20', view: 'week', display: 'list' };
    assert.deepEqual(readNavigation(navigationUrl(state, today), today), state);
  }
});
void test('legacy hash links migrate to clean paths', () => {
  const state = readNavigation('/#page=settings&date=2026-10-20&view=week&display=list', today);
  assert.equal(state.page, 'settings');
  assert.equal(navigationUrl(state, today), '/settings');
  const calendar = readNavigation('#page=analytics&date=2026-10-20&view=month&display=list', today);
  assert.equal(navigationUrl(calendar, today), '/statistics?date=2026-10-20&view=month&display=list');
});
void test('invalid dates, routes and parameters are normalized', () => {
  assert.deepEqual(readNavigation('/missing?date=2026-02-30&view=wrong&display=wrong', today), defaults);
  assert.equal(navigationUrl(readNavigation('/settings/?date=invalid', today), today), '/settings');
  assert.equal(navigationUrl(readNavigation('/setting', today), today), '/settings');
  assert.equal(navigationUrl(readNavigation('/analytics', today), today), '/statistics');
  assert.equal(
    navigationUrl(
      readNavigation('/?date=2026-10-23&view=day&display=timeline&extra=value', today),
      today,
    ),
    '/',
  );
});
