<script setup lang="ts">
import { computed, ref } from 'vue';
import { Clock3, Activity, Plus, Layers } from 'lucide-vue-next';
import type { WorkspaceView } from '../../../features/workspace/index.ts';
import { activityIcons } from '../../../entities/activity/index.ts';
import { dashboardMetrics } from '../model/metrics.ts';
import MetricPicker from './MetricPicker.vue';
const props = defineProps<{ model: WorkspaceView }>();
const editing = ref(false);
const icons: Record<string, typeof Clock3> = { ...activityIcons, clock: Clock3, activity: Activity };
const periodLabels = {
  day: 'За выбранный день',
  week: 'За выбранную неделю',
  month: 'За выбранный месяц',
};
const cards = computed(() =>
  dashboardMetrics(props.model.dashboardCards, {
    summary: props.model.stats,
    active: props.model.active.length,
    analytics: props.model.page === 'analytics',
    period: periodLabels[props.model.view],
  }),
);
</script>
<template>
  <div class="metrics-toolbar">
    <button class="text-button metrics-add" @click="editing = true">
      <Plus :size="17" />Настроить карточки
    </button>
  </div>
  <div v-if="cards.length" class="stats-grid">
    <article
      v-for="card in cards"
      :key="card.id"
      class="stat-card"
      :style="{ '--metric-color': card.color }"
    >
      <span class="stat-icon" :class="card.tone"
        ><component :is="icons[card.icon] || Layers" :size="19"
      /></span>
      <span class="stat-label">{{ card.label }}</span>
      <strong
        >{{ card.value }}<small v-if="card.detail"> {{ card.detail }}</small></strong
      >
      <span class="stat-foot">{{ card.caption }}</span>
      <div class="stat-decoration" :class="card.tone + '-line'" />
    </article>
  </div>
  <div v-else class="metrics-empty">Карточки скрыты. Добавить их можно через «Настроить карточки».</div>
  <MetricPicker
    v-if="editing"
    :categories="model.categories"
    :selection="model.dashboardCards"
    :save="model.saveDashboardCards"
    @close="editing = false"
  />
</template>
<style scoped>
.metrics-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
.metrics-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.stat-icon.custom {
  color: var(--metric-color);
  background: color-mix(in srgb, var(--metric-color) 15%, transparent);
}
.custom-line {
  background: linear-gradient(90deg, var(--metric-color), transparent);
}
.stat-label {
  padding-right: 35px;
  overflow-wrap: anywhere;
}
.metrics-empty {
  padding: 18px;
  margin-bottom: 22px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--muted);
}
</style>
