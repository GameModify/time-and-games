import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interval, page, device, start, trackingDatabase } from './tracking-fixture.ts';
import { storePage } from '../server/tracking/storage.ts';
import { importInterval } from '../server/tracking/import.ts';
import { rangeSessions } from '../server/tracking/live.ts';
import { websiteUsage } from '../src/entities/activity/index.ts';
import { workRule } from '../src/pages/settings/model/workRules.ts';
import type { WorkRuleDraft } from '../src/pages/settings/model/workRules.ts';
import type { Category, Session } from '../src/shared/api/contracts.ts';
const draft: WorkRuleDraft = {
  source: 'host',
  value: 'https://research.example/paper',
  name: 'Research',
  activity: 'science',
  project: 'Thesis',
};
function row(id: string, host: string, from: number, to: number, project?: string): Session {
  return {
    id,
    category_id: 'neutral',
    game_id: null,
    title: id,
    note: '',
    start_at: from,
    end_at: to,
    created_at: 1,
    tracking_context: { website: host, project },
  };
}
const work: Category = {
  id: 'work',
  name: 'Work',
  group_name: 'Work',
  color: '#123456',
  icon: 'code',
  sort_order: 1,
  is_work: true,
};
void test('imported website and project context survives database reads', () => {
  const db = trackingDatabase(),
    item = interval({ website: 'research.example', project: 'Thesis' });
  try {
    storePage(db, page(item));
    importInterval(db, { id: item.id, device_id: device, category_id: 'coding' });
    assert.deepEqual(rangeSessions(db, start, start + 200000)[0]?.tracking_context, {
      website: 'research.example',
      project: 'Thesis',
    });
  } finally {
    db.close();
  }
});
void test('website totals merge overlaps, keep gaps and exclude work or assigned projects', () => {
  const rows = [
    row('one', 'example.org', 0, 100),
    row('two', 'example.org', 50, 120),
    row('three', 'chatgpt.com', 200, 250),
    row('project', 'research.example', 0, 999, 'Thesis'),
    { ...row('work', 'work.example', 0, 999), category_id: 'work' },
  ];
  const result = websiteUsage(rows, [work], 1000, { from: 60, to: 240 });
  assert.equal(result.elapsed, 100);
  assert.equal(result.sites.length, 2);
  assert.equal(result.sites[0]?.elapsed, 60);
  assert.equal(result.sites[1]?.elapsed, 40);
});
void test('friendly rules normalize addresses, preserve project identity and replace the same target', () => {
  const site = workRule(draft, []);
  assert.equal(site.field, 'host');
  assert.equal(site.value, 'research.example');
  assert.equal(site.scope, 'focus');
  assert.equal(site.project, 'Thesis');
  assert.equal(workRule({ ...draft, project: 'Other' }, [site]).id, site.id);
  const channel = workRule(
    { ...draft, source: 'media_creator', value: 'https://www.youtube.com/@training' },
    [],
  );
  assert.equal(channel.value, '/@training');
  assert.equal(channel.scope, 'media');
  const video = workRule(
    { ...draft, source: 'media_id', value: 'https://www.youtube.com/watch?v=example12345' },
    [],
  );
  assert.equal(video.value, 'example12345');
});
