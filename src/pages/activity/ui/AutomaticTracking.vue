<script setup lang="ts">
import { idleTimeout, inactivityMessage } from '../../../shared/lib/trackingIdle.ts';

import { computed } from 'vue';
import { workingApplication } from '../model/workContext.ts';
import BrowserTracking from './BrowserTracking.vue';
import WorkTracking from './WorkTracking.vue';
import type { Category } from '../../../shared/api/contracts.ts';
import GameTracking from './GameTracking.vue';
import AssistantTracking from './AssistantTracking.vue';
import GameCandidate from './GameCandidate.vue';
import { Pause, Play, Radio } from 'lucide-vue-next';
import { useAutomaticTracking } from '../model/useAutomaticTracking.ts';
const props = defineProps<{ now: number; categories: Category[] }>();
const state = useAutomaticTracking();
const work = computed(() =>
  workingApplication(state.value?.status, state.value?.settings, props.categories, props.now),
);
const playback = computed(
  () =>
    state.value?.status?.playback.filter(
      (item) => props.now >= item.observed_at && props.now - item.observed_at < 15000,
    ) ?? [],
);
const foreground = computed(() => {
  const item = state.value?.status?.foreground;
  return item &&
    props.now - item.timestamp < 15000 &&
    item.resource_kind &&
    (item.resource_kind === 'document' || (item.resource_kind === 'game' && !state.value?.status?.game))
    ? item
    : null;
});
const foregroundActive = computed(() =>
  Boolean(foreground.value?.active && foreground.value.idle_ms < idleTimeout(state.value?.status)),
);
function position(value?: number): string {
  if (value === undefined) return '';
  const seconds = Math.floor(value);
  return 'На отметке ' + String(Math.floor(seconds / 60)) + ':' + String(seconds % 60).padStart(2, '0');
}
</script>
<template>
  <section v-if="state?.settings.enabled" class="automatic-tracking" aria-label="Автоматический учёт">
    <h3><Radio :size="17" />Автоматический учёт</h3>
    <p v-if="!state.settings.auto_import" class="muted">
      Автоматическое добавление записей выключено в настройках.
    </p>
    <p v-else-if="!state.connected" class="muted">
      Нет связи с трекером. Новое время пока не добавляется.
    </p>
    <p v-else-if="state.status?.paused" class="muted">Сбор событий приостановлен в трекере.</p>
    <div v-for="item in playback" v-else :key="item.channel" class="automatic-item">
      <Play v-if="item.playing" :size="16" /><Pause v-else :size="16" />
      <div>
        <strong>{{ item.title || 'Видео' }}</strong
        ><small
          >{{ item.playing ? 'Воспроизводится' : 'На паузе, время не учитывается'
          }}<template v-if="position(item.position_seconds)">
            · {{ position(item.position_seconds) }}</template
          ></small
        >
      </div>
    </div>
    <BrowserTracking v-if="state.connected && !state.status?.paused" :status="state.status" :now="now" />
    <AssistantTracking
      v-if="state.connected && !state.status?.paused"
      :status="state.status"
      :now="now"
    />
    <WorkTracking
      v-if="state.connected && !state.status?.paused"
      :status="state.status"
      :settings="state.settings"
      :categories="categories"
      :now="now"
    />
    <GameCandidate v-if="state.connected && !state.status?.paused" :status="state.status" :now="now" />
    <GameTracking v-if="state.connected && !state.status?.paused" :status="state.status" :now="now" />
    <div v-if="state.connected && !state.status?.paused && foreground" class="automatic-item">
      <Play v-if="foregroundActive" :size="16" /><Pause v-else :size="16" />
      <div>
        <strong>{{ foreground.title }}</strong
        ><small
          >{{ foreground.resource_kind === 'game' ? 'Игра в активном окне' : 'Работа с документом' }} ·
          {{ foregroundActive ? 'учитывается' : inactivityMessage(state?.status) }}</small
        >
      </div>
    </div>
    <div
      v-if="state.connected && !state.status?.paused && state.status?.voice?.state === 'connected'"
      class="automatic-item"
    >
      <Radio :size="16" />
      <div><strong>Discord: голосовой канал</strong><small>Подключение подтверждено</small></div>
    </div>
    <p
      v-if="
        state.connected &&
        state.settings.auto_import &&
        !state.status?.paused &&
        !playback.length &&
        !state.status?.assistant &&
        !state.status?.browser?.active &&
        !foreground &&
        !work &&
        !state.status?.game &&
        state.status?.voice?.state !== 'connected'
      "
      class="muted"
    >
      Ожидаем активность сборщиков. Учтённые отрезки появятся на таймлайне автоматически.
    </p>
  </section>
</template>
<style scoped>
.automatic-tracking {
  margin-top: 16px;
  padding: 18px 22px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}
h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  margin: 0 0 12px;
}
p {
  margin: 0;
}
.automatic-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.automatic-item div {
  min-width: 0;
}
strong {
  font-weight: 500;
  overflow-wrap: anywhere;
}
small {
  display: block;
  color: var(--muted);
  margin-top: 5px;
}
</style>
