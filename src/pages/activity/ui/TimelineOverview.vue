<script setup lang="ts">
import { computed } from 'vue';
import type { CategoryLane, TrackRange } from '../../../entities/activity/index.ts';
import { overviewTicks, trackPercent } from '../../../entities/activity/index.ts';
import { duration, localDate } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
import { useTimelineDrag, dragStyle } from '../model/useTimelineDrag.ts';
const props = defineProps<{
  lanes: CategoryLane[];
  range: TrackRange;
  date: string;
  now: number;
  selected?: string;
}>();
const emit = defineEmits<{ select: [id: string]; zoom: [range: TrackRange] }>();
const { drag, skippedClick, down, move, up, cancel } = useTimelineDrag(
  () => props.range,
  (range) => {
    emit('zoom', range);
  },
);
const ticks = computed(() => overviewTicks(props.range));
const current = computed(
  () =>
    localDate(props.now) === props.date && props.now >= props.range.from && props.now <= props.range.to,
);
function percent(value: number): string {
  return `${trackPercent(value, props.range)}%`;
}
function style(band: TrackRange) {
  return {
    left: percent(band.from),
    width: `${trackPercent(band.to, props.range) - trackPercent(band.from, props.range)}%`,
  };
}
function choose(id: string): void {
  if (!skippedClick.value) emit('select', id);
  skippedClick.value = false;
}
function axisClock(value: number): string {
  return localDate(value) === props.date ? clock(value) : '24:00';
}
</script>
<template>
  <div class="overview" aria-label="Обзор занятий по категориям">
    <div class="axis row">
      <span>Категория</span>
      <div class="plot axis-plot">
        <span v-for="tick in ticks" :key="tick" class="tick" :style="{ left: percent(tick) }">{{
          axisClock(tick)
        }}</span>
      </div>
      <span class="total-label">Учтено</span>
    </div>
    <div
      v-for="lane in lanes"
      :key="lane.id"
      class="row lane"
      :class="{ chosen: selected === lane.id }"
      :style="{ '--lane-color': lane.color }"
    >
      <button
        class="category-label"
        :aria-label="`Открыть категорию ${lane.name}`"
        @click="emit('select', lane.id)"
      >
        <i aria-hidden="true" /><span>{{ lane.name }}</span>
      </button>
      <button
        class="plot"
        :aria-label="`${lane.name}: ${duration(lane.elapsed, true)}. Открыть занятия`"
        @click="choose(lane.id)"
        @pointerdown="down($event, lane.id)"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="cancel"
        @lostpointercapture="cancel"
      >
        <span class="track" />
        <span v-for="tick in ticks" :key="tick" class="grid" :style="{ left: percent(tick) }" />
        <span
          v-for="band in lane.bands.filter((band) => band.to > range.from && band.from < range.to)"
          :key="band.from"
          class="band"
          :style="style(band)"
        />
        <span v-if="current" class="now" :style="{ left: percent(now) }" />
        <span v-if="drag?.lane === lane.id" class="selection" :style="dragStyle(drag)" />
      </button>
      <span class="total">{{ duration(lane.elapsed) }}</span>
    </div>
  </div>
</template>
<style scoped>
.overview {
  padding: 0 20px 16px;
}
.row {
  display: grid;
  grid-template-columns: 165px minmax(0, 1fr) 86px;
  gap: 12px;
  align-items: center;
}
.axis {
  min-height: 38px;
  color: var(--muted);
  font-size: 12px;
}
.lane {
  min-height: 48px;
}
.category-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  background: transparent;
  border: 0;
  text-align: left;
  min-width: 0;
  padding: 10px 0;
  cursor: pointer;
}
.category-label span {
  overflow-wrap: anywhere;
}
.category-label i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
  background: var(--lane-color);
}
.plot {
  position: relative;
  min-width: 0;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  touch-action: pan-y;
  user-select: none;
  cursor: crosshair;
}
.axis-plot {
  height: 32px;
  cursor: default;
}
.tick {
  position: absolute;
  top: 8px;
  white-space: nowrap;
  transform: translateX(-50%);
}
.tick:first-child {
  transform: none;
}
.tick:last-child {
  transform: translateX(-100%);
}
.track {
  position: absolute;
  inset: 16px 0;
  background: var(--line);
  opacity: 0.35;
  border-radius: 3px;
}
.grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line);
  opacity: 0.5;
}
.band {
  position: absolute;
  top: 13px;
  height: 18px;
  border-radius: 3px;
  background: var(--lane-color);
  pointer-events: none;
}
.now {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed var(--text);
  opacity: 0.65;
  pointer-events: none;
}
.selection {
  position: absolute;
  top: 3px;
  bottom: 3px;
  background: var(--accent-surface);
  outline: 1px solid var(--accent-text);
  opacity: 0.85;
  pointer-events: none;
}
.total,
.total-label {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.total {
  font-size: 13px;
  white-space: nowrap;
}
.chosen .category-label {
  color: var(--accent-text);
}
button:focus-visible {
  outline: 2px solid var(--accent-text);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (max-width: 700px) {
  .overview {
    padding-inline: 14px;
  }
  .row {
    grid-template-columns: 115px minmax(0, 1fr) 67px;
    gap: 8px;
  }
  .category-label {
    font-size: 13px;
    gap: 7px;
  }
  .total {
    font-size: 12px;
  }
}
@media (max-width: 420px) {
  .row {
    grid-template-columns: 90px minmax(0, 1fr) 60px;
    gap: 5px;
  }
  .category-label i {
    display: none;
  }
  .axis {
    font-size: 11px;
  }
  .axis-plot .tick:nth-child(even):not(:last-child) {
    display: none;
  }
}
</style>
