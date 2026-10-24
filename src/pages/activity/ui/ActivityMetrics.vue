<script setup lang="ts">
import { computed, ref, toRefs } from 'vue';
import { Clock3, Code2, Gamepad2, Activity, Plus, Layers } from 'lucide-vue-next';
import type { WorkspaceView } from '../../../features/workspace/index.ts';
import { activityIcons } from '../../../entities/activity/index.ts';
import { duration } from '../../../shared/lib/date.ts';
import MetricPicker from './MetricPicker.vue';
const props = defineProps<{ model: WorkspaceView }>();
const { stats, active, page, dashboardCards } = toRefs(props.model);
const editing = ref(false);
const periodLabels = {
  day: 'За выбранный день',
  week: 'За выбранную неделю',
  month: 'За выбранный месяц',
};
const additional = computed(() =>
  dashboardCards.value.category_ids.flatMap((id) => {
    const category = stats.value.byCategory.find((item) => item.id === id);
    return category ? [category] : [];
  }),
);
</script>
<template>
  <div class="metrics-toolbar">
    <button class="text-button metrics-add" @click="editing = true">
      <Plus :size="17" />Добавить карточку
    </button>
  </div>
  <div class="stats-grid">
    <article class="stat-card">
      <span class="stat-icon purple"><Clock3 :size="19" /></span
      ><span class="stat-label">Учтено времени</span><strong>{{ duration(stats.total) }}</strong
      ><span class="stat-foot">Общее время без повторного счёта</span>
      <div class="stat-decoration purple-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon blue"><Code2 :size="19" /></span
      ><span class="stat-label">Время за работой</span><strong>{{ duration(stats.work) }}</strong
      ><span class="stat-foot">Кодинг, учёба и твои проекты</span>
      <div class="stat-decoration blue-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon orange"><Gamepad2 :size="19" /></span
      ><span class="stat-label">Игровое время</span
      ><strong>{{
        duration(
          stats.byCategory
            .filter((c) => c.group_name === 'Развлечения' && (c.icon === 'gamepad' || c.name === 'Игры'))
            .reduce((sum, c) => sum + c.duration, 0),
        )
      }}</strong
      ><span class="stat-foot">Место для нового приключения</span>
      <div class="stat-decoration orange-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon green"><Activity :size="19" /></span
      ><span class="stat-label">{{
        page === 'analytics' ? 'Записей за период' : 'Активных таймеров'
      }}</span
      ><strong
        >{{ page === 'analytics' ? stats.count : String(active.length).padStart(2, '0')
        }}<small>{{
          page === 'analytics' ? ' сессий' : active.length ? ' в процессе' : ' можно начинать'
        }}</small></strong
      ><span class="stat-foot">{{
        page === 'analytics' ? 'Включая параллельные занятия' : 'Занятия можно совмещать'
      }}</span>
      <div class="stat-decoration green-line" />
    </article>
    <article
      v-for="category in additional"
      :key="category.id"
      class="stat-card category-metric"
      :style="{ '--metric-color': category.color }"
    >
      <span class="stat-icon category-icon"
        ><component :is="activityIcons[category.icon] || Layers" :size="19"
      /></span>
      <span class="stat-label">{{ category.name }}</span>
      <strong>{{ duration(category.duration) }}</strong>
      <span class="stat-foot">{{ periodLabels[model.view] }}</span>
      <div class="stat-decoration category-line" />
    </article>
  </div>

  <MetricPicker
    v-if="editing"
    :categories="model.categories"
    :selection="dashboardCards"
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
.category-icon {
  color: var(--metric-color);
  background: color-mix(in srgb, var(--metric-color) 15%, transparent);
}
.category-line {
  background: linear-gradient(90deg, var(--metric-color), transparent);
}
.category-metric .stat-label {
  padding-right: 35px;
  overflow-wrap: anywhere;
}
</style>
