<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight, Clock3, Plus, ZoomIn } from 'lucide-vue-next';
import type { Category, Session, Game } from '../../../shared/api/contracts.ts';
import {
  activityTracks,
  activityTracksInRange,
  tracksInRange,
  categoryLanes,
  currentActivities,
  focusedTrackRange,
  recentTrackRange,
  shiftedTrackRange,
  zoomTrackRange,
} from '../../../entities/activity/index.ts';
import type { ActivityTrack, TrackRange, RecentTrackHours } from '../../../entities/activity/index.ts';
import { dayBounds, localDate } from '../../../shared/lib/date.ts';
import { clock, shortDate } from '../../../shared/lib/format.ts';
import { sortedLanes } from '../model/timelineSummary.ts';
import type { TimelineOrder } from '../model/timelineSummary.ts';
import ClassificationDialog from './ClassificationDialog.vue';
import CurrentActivities from './CurrentActivities.vue';
import TimelinePeriodPicker from './TimelinePeriodPicker.vue';
import TimelineOverview from './TimelineOverview.vue';
import TimelineDetails from './TimelineDetails.vue';
const props = defineProps<{
  sessions: Session[];
  categories: Category[];
  games: Game[];
  date: string;
  now: number;
  hours: RecentTrackHours | null;
}>();
const emit = defineEmits<{
  edit: [session?: Session];
  period: [hours: RecentTrackHours | null];
  refresh: [];
}>();
const classification = ref<Session | null>(null);
const selection = ref<TrackRange | null>(null);
const order = ref<TimelineOrder>('desc');
const selectedCurrent = ref(false);
const selectedId = ref(''),
  selectedItem = ref(''),
  expanded = ref(false);
const bounds = computed(() => {
  if (props.hours !== null) return recentTrackRange(props.now, props.hours);
  const [from, to] = dayBounds(props.date);
  return { from, to };
});
const tracks = computed(() =>
  activityTracksInRange(props.sessions, bounds.value, props.now).map(labelTrack),
);
const currentDate = computed(() => (props.hours === null ? props.date : localDate(props.now)));
const dayTracks = computed(() =>
  activityTracks(props.sessions, currentDate.value, props.now).map(labelTrack),
);
const lanes = computed(() => categoryLanes(dayTracks.value, props.categories));

const live = computed(() => currentActivities(dayTracks.value, currentDate.value, props.now));

const range = computed(() => selection.value ?? bounds.value);
const windowLanes = computed(() =>
  categoryLanes(tracksInRange(tracks.value, range.value), props.categories),
);
const ordered = computed(() => sortedLanes(windowLanes.value, order.value));
const visible = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, 6)));
const selected = computed(() =>
  (selectedCurrent.value ? lanes.value : windowLanes.value).find((lane) => lane.id === selectedId.value),
);
const rangeLabel = computed(() => {
  const { from, to } = range.value;
  if (localDate(from) !== localDate(to - 1))
    return `${shortDate(localDate(from))}, ${clock(from)} - ${shortDate(localDate(to))}, ${clock(to)}`;
  return `${clock(from)} - ${to === dayBounds(localDate(from))[1] ? '24:00' : clock(to)}`;
});
const zoomed = computed(() => range.value.to - range.value.from < bounds.value.to - bounds.value.from);
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
function changeMode(hours: RecentTrackHours | null): void {
  selection.value = null;
  emit('period', hours);
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
  selection.value = focusedTrackRange({ from: item.start, to: item.end }, bounds.value);
  selectedId.value = '';
}
function classify(session: Session): void {
  selectedId.value = '';
  classification.value = session;
}
function classified(): void {
  classification.value = null;
  emit('refresh');
}
function edit(session: Session): void {
  selectedId.value = '';
  emit('edit', session);
}
</script>
<template>
  <div class="day-overview">
    <CurrentActivities
      v-if="currentDate === localDate(now)"
      :items="live"
      :categories="categories"
      @select="showCurrent"
    />
    <div class="overview-toolbar">
      <TimelinePeriodPicker :hours="hours" :active="!selection" @period="changeMode" />
    </div>
    <div v-if="windowLanes.length || selection" class="range-toolbar">
      <span>{{ rangeLabel }}<small>Пробелы на дорожках - время без учёта в этой категории.</small></span>
      <div class="range-actions">
        <button
          class="icon-button"
          aria-label="Предыдущий участок графика"
          :disabled="!zoomed || range.from <= bounds.from"
          @click="selection = shiftedTrackRange(range, bounds, -1)"
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
          :disabled="!zoomed || range.to >= bounds.to"
          @click="selection = shiftedTrackRange(range, bounds, 1)"
        >
          <ChevronRight :size="17" />
        </button>
        <button v-if="selection" class="text-button" @click="selection = null">
          Сбросить приближение
        </button>
      </div>
    </div>
    <div v-if="!windowLanes.length" class="track-empty">
      <Clock3 :size="28" /><strong>За этот период пока нет записей</strong
      ><button class="button secondary" @click="emit('edit')"><Plus :size="15" />Добавить запись</button>
    </div>
    <template v-else>
      <TimelineOverview
        :lanes="visible"
        :range="range"
        :now="now"
        :selected="selectedId"
        :order="order"
        @sort="order = order === 'desc' ? 'asc' : 'desc'"
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
      @classify="classify"
    />
    <ClassificationDialog
      v-if="classification"
      :session="classification"
      :categories="categories"
      initialScope="site"
      @close="classification = null"
      @saved="classified"
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
