<script setup lang="ts">
import { computed, ref } from 'vue';
import { Clock3, Plus } from 'lucide-vue-next';
import type { Category, Session } from '../../../shared/api/contracts.ts';
import {
  activityTracks,
  trackRange,
  trackTicks,
  trackPercent,
  trackGeometry,
} from '../../../entities/activity/index.ts';
import type { ActivityTrack, TrackSegment } from '../../../entities/activity/index.ts';
import { duration, localDate } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
const props = defineProps<{ sessions: Session[]; categories: Category[]; date: string; now: number }>();
const emit = defineEmits<{ edit: [session?: Session] }>();
const mode = ref('activity'),
  selectedId = ref('');
const tracks = computed(() => activityTracks(props.sessions, props.date, props.now));
const range = computed(() => trackRange(tracks.value, props.date, mode.value === 'day'));
const ticks = computed(() => trackTicks(range.value, mode.value === 'detail'));
const selected = computed(
  () => tracks.value.find((track) => track.id === selectedId.value) ?? tracks.value.at(-1),
);
const boardWidth = computed(() =>
  mode.value === 'detail'
    ? `${Math.max(780, ((range.value.to - range.value.from) / 3600000) * 160 + 230)}px`
    : '100%',
);
const current = computed(
  () =>
    props.date === localDate(props.now) && props.now >= range.value.from && props.now <= range.value.to,
);
function category(id: string): Category | undefined {
  return props.categories.find((item) => item.id === id);
}
function title(track: ActivityTrack): string {
  return track.title || category(track.category)?.name || 'Занятие';
}
function segmentStyle(segment: TrackSegment) {
  const rect = trackGeometry(segment, range.value);
  return { left: `${rect.left}%`, width: `${rect.width}%` };
}
function select(track: ActivityTrack): void {
  selectedId.value = track.id;
}
function axisClock(value: number): string {
  return localDate(value) === props.date ? clock(value) : '24:00';
}
</script>
<template>
  <div class="day-tracks">
    <div class="track-toolbar">
      <div>
        <strong>Занятия за день</strong>
        <p>Одна строка на занятие. Пустые промежутки между цветными отрезками - перерывы.</p>
      </div>
      <div class="segmented" aria-label="Масштаб графика">
        <button :class="{ active: mode === 'activity' }" @click="mode = 'activity'">
          По активности
        </button>
        <button :class="{ active: mode === 'day' }" @click="mode = 'day'">Весь день</button>
        <button :class="{ active: mode === 'detail' }" @click="mode = 'detail'">Подробнее</button>
      </div>
    </div>
    <div v-if="!tracks.length" class="track-empty">
      <Clock3 :size="28" /><strong>В этот день пока нет записей</strong>
      <button class="button secondary" @click="emit('edit')"><Plus :size="15" />Добавить запись</button>
    </div>
    <template v-else>
      <div class="track-scroll" tabindex="0" aria-label="График занятий по времени">
        <div class="track-board" :style="{ width: boardWidth }">
          <div class="track-axis track-row">
            <span class="axis-label">Занятие / учтённое время</span>
            <div class="axis-plot">
              <span
                v-for="tick in ticks"
                :key="tick"
                class="tick-label"
                :style="{ left: `${trackPercent(tick, range)}%` }"
                >{{ axisClock(tick) }}</span
              >
            </div>
          </div>
          <div
            v-for="track in tracks"
            :key="track.id"
            class="track-row"
            :class="{ chosen: selected?.id === track.id }"
            :style="{ '--track-color': category(track.category)?.color || '#8e77ff' }"
          >
            <button class="track-label" :aria-pressed="selected?.id === track.id" @click="select(track)">
              <i />
              <div>
                <strong>{{ title(track) }}</strong
                ><small
                  >{{ category(track.category)?.name }} · {{ duration(track.elapsed, true) }}</small
                >
              </div>
            </button>
            <div class="track-plot">
              <span
                v-for="tick in ticks"
                :key="tick"
                class="grid-tick"
                :style="{ left: `${trackPercent(tick, range)}%` }"
              />
              <button
                v-for="segment in track.segments"
                :key="segment.session.id"
                class="track-segment"
                :style="segmentStyle(segment)"
                :aria-label="`${title(track)}: ${clock(segment.start)} - ${clock(segment.end)}, ${duration(segment.end - segment.start, true)}`"
                @click="select(track)"
              />
              <span v-if="current" class="track-now" :style="{ left: `${trackPercent(now, range)}%` }" />
            </div>
          </div>
        </div>
      </div>
      <section v-if="selected" class="selected-track" aria-label="Выбранное занятие">
        <div class="selected-heading">
          <span class="category-dot" :style="{ background: category(selected.category)?.color }" />
          <div>
            <h3>{{ title(selected) }}</h3>
            <p>
              {{ category(selected.category)?.name }} · {{ clock(selected.start) }} -
              {{ clock(selected.end) }}
            </p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Учтено</dt>
            <dd>{{ duration(selected.elapsed, true) }}</dd>
          </div>
          <div>
            <dt>Перерывы</dt>
            <dd>{{ duration(selected.paused, true) }}</dd>
          </div>
          <div>
            <dt>Отрезков</dt>
            <dd>{{ selected.segments.length }}</dd>
          </div>
        </dl>
        <details>
          <summary>Отрезки и заметки</summary>
          <div class="track-details">
            <button
              v-for="segment in selected.segments"
              :key="segment.session.id"
              class="button secondary"
              :disabled="segment.session.tracking_live"
              @click="emit('edit', segment.session)"
            >
              <span
                >{{ clock(segment.start) }} - {{ clock(segment.end) }} ·
                {{ duration(segment.end - segment.start, true) }}</span
              ><span v-if="segment.session.note">{{ segment.session.note }}</span
              ><small>{{ segment.session.tracking_live ? 'Сейчас учитывается' : 'Изменить' }}</small>
            </button>
          </div>
        </details>
      </section>
    </template>
  </div>
</template>
<style scoped>
.day-tracks {
  --label-width: 230px;
}
.track-toolbar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.track-toolbar strong {
  font-weight: 500;
}
.track-toolbar p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 13px;
  max-width: 470px;
}
.track-scroll {
  overflow: auto;
  max-height: 620px;
  border-block: 1px solid var(--line);
  scrollbar-gutter: stable;
}
.track-board {
  min-width: 0;
}
.track-row {
  display: grid;
  grid-template-columns: var(--label-width) minmax(0, 1fr);
  min-height: 80px;
  border-bottom: 1px solid var(--line);
}
.track-row:last-child {
  border-bottom: 0;
}
.track-axis {
  min-height: 42px;
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface);
}
.axis-label {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--muted);
  position: sticky;
  left: 0;
  background: var(--surface);
  z-index: 2;
}
.axis-plot {
  position: relative;
  margin-right: 22px;
}
.tick-label {
  position: absolute;
  top: 12px;
  font-size: 12px;
  color: var(--muted);
  transform: translateX(-50%);
}
.tick-label:first-child {
  transform: none;
}
.tick-label:last-child {
  transform: translateX(-100%);
}
.track-label {
  position: sticky;
  left: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--surface);
  text-align: left;
  border: 0;
  border-right: 1px solid var(--line);
  color: var(--text);
  cursor: pointer;
  min-width: 0;
}
.track-label i,
.category-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--track-color);
}
.track-label div {
  min-width: 0;
}
.track-label strong {
  font-size: 14px;
  line-height: 1.45;
  font-weight: 500;
  display: block;
  overflow-wrap: anywhere;
}
.track-label small {
  font-size: 12px;
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.track-row.chosen .track-label {
  box-shadow: inset 3px 0 var(--track-color);
  background: var(--surface-alt, var(--surface));
}
.track-plot {
  position: relative;
  margin-right: 22px;
  min-height: 80px;
}
.grid-tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line);
  opacity: 0.6;
  pointer-events: none;
}
.track-segment {
  position: absolute;
  top: calc(50% - 12px);
  height: 24px;
  min-width: 2px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: var(--track-color);
  cursor: pointer;
}
.track-segment:focus-visible,
.track-label:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 3px;
}
.track-now {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  border-left: 1px dashed var(--muted);
  pointer-events: none;
}
.selected-track {
  padding: 20px;
  background: var(--surface);
}
.selected-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
h3 {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  overflow-wrap: anywhere;
}
.selected-heading p {
  color: var(--muted);
  font-size: 13px;
  margin: 5px 0 0;
}
dl {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 36px;
  margin: 20px 0;
}
dt {
  color: var(--muted);
  font-size: 12px;
}
dd {
  margin: 5px 0 0;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
summary {
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.track-details {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  max-height: 300px;
  overflow: auto;
}
.track-details button {
  justify-content: space-between;
  flex-wrap: wrap;
  white-space: normal;
  text-align: left;
}
.track-details button span {
  overflow-wrap: anywhere;
}
.track-empty {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 50px 20px;
  color: var(--muted);
}
@media (max-width: 700px) {
  .day-tracks {
    --label-width: 185px;
  }
  .track-toolbar {
    padding: 16px;
  }
}
</style>
