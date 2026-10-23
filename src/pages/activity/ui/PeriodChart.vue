<script setup lang="ts">
import type { Category } from '../../../shared/api/contracts.ts';
import type { activityBuckets } from '../../../entities/activity/index.ts';

import { computed } from 'vue';
import { duration } from '../../../shared/lib/date.ts';
import { shortDate, weekday } from '../../../shared/lib/format.ts';
const props = defineProps<{
  buckets: ReturnType<typeof activityBuckets<Category>>;
  categories: (Category & { duration: number })[];
  view: string;
}>();
defineEmits<{ 'open-day': [date: string] }>();
const maximum = computed(() => Math.max(1, ...props.buckets.map((b) => b.categoryTotal)));
function description(b: (typeof props.buckets)[number]) {
  return `${props.view === 'day' ? b.label : shortDate(b.date)} · Реальное время: ${duration(b.total)}. ${b.byCategory
    .filter((c) => c.duration)
    .map((c) => `${c.name}: ${duration(c.duration)}`)
    .join('; ')}`;
}
</script>
<template>
  <div class="period-chart">
    <p class="chart-caption">{{ view === 'day' ? 'Занятия по часам' : 'Занятия по дням' }}</p>
    <div class="chart-scroll">
      <div :class="['chart-bars', { 'many-buckets': view !== 'week' }]">
        <button
          v-for="(b, index) in buckets"
          :key="b.key"
          class="chart-day"
          :title="description(b)"
          :aria-label="description(b)"
          @click="$emit('open-day', b.date)"
        >
          <span class="bar-track"
            ><span class="category-stack" :style="{ height: `${(b.categoryTotal / maximum) * 100}%` }"
              ><span
                v-for="c in b.byCategory.filter((c) => c.duration)"
                :key="c.id"
                :style="{
                  height: `${(c.duration / b.categoryTotal) * 100}%`,
                  background: c.color,
                }" /></span
          ></span>
          <small>{{
            view === 'day'
              ? index % 3 === 0
                ? b.label
                : ''
              : view === 'week'
                ? weekday(b.date)
                : Number(b.label)
          }}</small>
        </button>
      </div>
    </div>
    <div class="chart-legend">
      <span v-for="c in categories" :key="c.id"
        ><i class="legend-dot" :style="{ background: c.color }" />{{ c.name }}</span
      >
    </div>
    <p class="chart-caption">
      Цвета - категории. Одновременные занятия показаны каждое в своей категории.
    </p>
    <div v-if="!categories.length" class="empty-chart">За этот период пока нет записей</div>
  </div>
</template>
