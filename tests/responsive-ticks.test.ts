import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plotTicks } from '../src/pages/activity/model/timelineSummary.ts';
import type { TrackRange } from '../src/entities/activity/index.ts';
import { start, end, minute } from './timeline-fixture.ts';
function assertReadable(range: TrackRange, width: number): void {
  const ticks = plotTicks(range, width);
  assert.equal(ticks[0], range.from);
  assert.equal(ticks.at(-1), range.to);
  assert.equal(new Set(ticks).size, ticks.length);
  const boxes = ticks.map((tick, index) => {
    const x = ((tick - range.from) / (range.to - range.from)) * width;
    const left = index === 0 ? 0 : index === ticks.length - 1 ? width - 44 : x - 22;
    return { left, right: left + 44 };
  });
  for (let index = 1; index < boxes.length; index++)
    assert.ok((boxes[index]?.left ?? 0) >= (boxes[index - 1]?.right ?? 0) + 6);
}
void test('timeline clock labels fit phone and desktop plot widths, including rolling periods', () => {
  const periods = [
    { from: start, to: end },
    { from: start - 114 * minute, to: start + 6 * minute },
    { from: start + 37 * minute, to: end + 37 * minute },
  ];
  for (const range of periods)
    for (const width of [120, 184, 254, 360, 600, 1000]) assertReadable(range, width);
});
void test('a plot with no measured width starts with two readable boundary labels', () => {
  assert.deepEqual(plotTicks({ from: start, to: end }, 0), [start, end]);
});
