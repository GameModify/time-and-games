<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Clock3, Plus, ZoomIn } from 'lucide-vue-next';
import type { Category, Session, Game } from '../../../shared/api/contracts.ts';
import {
  activityTracks,
  tracksInRange,
  categoryLanes,
  currentActivities,
  focusedTrackRange,
  recentTrackRange,
  shiftedTrackRange,
  zoomTrackRange,
} from '../../../entities/activity/index.ts';
import type { ActivityTrack, TrackRange } from '../../../entities/activity/index.ts';
import { dayBounds, localDate } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
import CurrentActivities from './CurrentActivities.vue';
import TimelineOverview from './TimelineOverview.vue';
import TimelineDetails from './TimelineDetails.vue';
const props = defineProps<{
  sessions: Session[];
  categories: Category[];
  games: Game[];
  date: string;
  now: number;
}>();
const emit = defineEmits<{ edit: [session?: Session] }>();
const mode = ref<'day' | 'recent'>('day'),
  selection = ref<TrackRange | null>(null);
const selectedCurrent = ref(false);
const selectedId = ref(''),
  selectedItem = ref(''),
  expanded = ref(false);
const tracks = computed(() => activityTracks(props.sessions, props.date, props.now).map(labelTrack));
const lanes = computed(() => categoryLanes(tracks.value, props.categories));

const live = computed(() => currentActivities(tracks.value, props.date, props.now));

const range = computed(() => {
  if (selection.value) return selection.value;
  if (mode.value === 'recent') return recentTrackRange(props.date, props.now, tracks.value);
  const [from, to] = dayBounds(props.date);
  return { from, to };
});
const windowLanes = computed(() =>
  categoryLanes(tracksInRange(tracks.value, range.value), props.categories),
);
const visible = computed(() => (expanded.value ? windowLanes.value : windowLanes.value.slice(0, 6)));
const selected = computed(() =>
  (selectedCurrent.value ? lanes.value : windowLanes.value).find((lane) => lane.id === selectedId.value),
);
const rangeLabel = computed(
  () =>
    `${clock(range.value.from)} - ${localDate(range.value.to) === props.date ? clock(range.value.to) : '24:00'}`,
);
const zoomed = computed(
  () => range.value.to - range.value.from < dayBounds(props.date)[1] - dayBounds(props.date)[0],
);
watch(() => props.date, reset);
function labelTrack(track: ActivityTrack): ActivityTrack {
  const game = props.games.find((item) => item.id === track.segments[0]?.session.game_id);
  return track.title || !game ? track : { ...track, title: game.name };
}
function reset(): void {
  selection.value = null;
  selectedId.value = '';
  selectedItem.value = '';
  expanded.value = false;
}
function changeMode(value: 'day' | 'recent'): void {
  mode.value = value;
  selection.value = null;
}
function choose(id: string): void {
  selectedCurrent.value = false;
  selectedId.value = id;
  selectedItem.value = '';
}
function showCurrent(item: ActivityTrack): void {
  selectedCurrent.value = true;
  selectedId.value = item.category;
  selectedItem.value = item.id;
}
function focus(item: ActivityTrack): void {
  selection.value = focusedTrackRange({ from: item.start, to: item.end }, props.date);
  selectedId.value = '';
}
function edit(session: Session): void {
  selectedId.value = '';
  emit('edit', session);
}
</script>
<template>
  <div class="day-overview">
    <CurrentActivities
      v-if="date === localDate(now)"
      :items="live"
      :categories="categories"
      @select="showCurrent"
    />
    <div class="overview-toolbar">
      <div class="segmented" aria-label="Период на графике">
        <button :class="{ active: mode === 'day' && !selection }" @click="changeMode('day')">
          Весь день
        </button>
        <button :class="{ active: mode === 'recent' && !selection }" @click="changeMode('recent')">
          Последние 2 часа
        </button>
      </div>
    </div>
    <div v-if="!tracks.length" class="track-empty">
      <Clock3 :size="28" /><strong>В этот день пока нет записей</strong
      ><button class="button secondary" @click="emit('edit')"><Plus :size="15" />Добавить запись</button>
    </div>
    <template v-else>
      <div class="range-toolbar">
        <span
          >{{ rangeLabel }}<small>Пробелы на дорожках - время без учёта в этой категории.</small></span
        >
        <div class="range-actions">
          <button
            class="icon-button"
            aria-label="Предыдущий участок графика"
            :disabled="!zoomed || range.from <= dayBounds(date)[0]"
            @click="selection = shiftedTrackRange(range, date, -1)"
          >
            <ChevronLeft :size="17" />
          </button>
          <button
            class="icon-button"
            aria-label="Приблизить график"
            :disabled="range.to - range.from <= 60000"
            @click="selection = zoomTrackRange(range, now)"
          >
            <ZoomIn :size="17" />
          </button>
          <button
            class="icon-button"
            aria-label="Следующий участок графика"
            :disabled="!zoomed || range.to >= dayBounds(date)[1]"
            @click="selection = shiftedTrackRange(range, date, 1)"
          >
            <ChevronRight :size="17" />
          </button>
          <button v-if="selection" class="text-button" @click="selection = null">
            Сбросить приближение
          </button>
        </div>
      </div>
      <TimelineOverview
        :lanes="visible"
        :range="range"
        :date="date"
        :now="now"
        :selected="selectedId"
        @select="choose"
        @zoom="selection = $event"
      />
      <button
        v-if="windowLanes.length > 6"
        class="text-button categories-toggle"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Свернуть категории' : `Ещё категории: ${windowLanes.length - 6}` }}
      </button>
      <p class="zoom-hint">
        Чтобы приблизить время, выдели участок на дорожке или нажми
        <ZoomIn :size="14" aria-label="Приблизить" />.
      </p>
    </template>
    <TimelineDetails
      v-if="selected"
      :key="selected.id"
      :lane="selected"
      :period="selectedCurrent ? 'За день' : rangeLabel"
      :selectedItem="selectedItem"
      @close="selectedId = ''"
      @focus="focus"
      @edit="edit"
    />
  </div>
</template>
<style scoped>
.overview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px;
}
.range-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 20px 10px;
}
.range-toolbar > span {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
small {
  display: block;
  color: var(--muted);
  margin-top: 5px;
  font-size: 12px;
}
.range-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}
.categories-toggle {
  margin: 0 20px 16px;
}
.zoom-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0 20px 18px;
  color: var(--muted);
  font-size: 12px;
}
.track-empty {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding: 40px 20px;
  color: var(--muted);
}
@media (max-width: 700px) {
  .overview-toolbar,
  .range-toolbar {
    padding-inline: 14px;
  }
  .zoom-hint {
    padding-inline: 14px;
  }
}
</style>
