<script setup lang="ts">
import { computed } from 'vue';
import type { Category, Session } from '../../../shared/api/contracts.ts';
import { websiteUsage } from '../../../entities/activity/index.ts';
import { dayBounds, duration } from '../../../shared/lib/date.ts';
const props = defineProps<{ sessions: Session[]; categories: Category[]; now: number; date: string }>();
const usage = computed(() => {
  const [from, to] = dayBounds(props.date);
  return websiteUsage(props.sessions, props.categories, props.now, { from, to });
});
</script>
<template>
  <details v-if="usage.sites.length" class="website-summary">
    <summary>
      <span>Работа с сайтами</span><strong>{{ duration(usage.elapsed, true) }}</strong
      ><small>Время по сайтам</small>
    </summary>
    <p>Обычные сайты и общение в браузере. Работа по правилам и проекты учитываются отдельно.</p>
    <div v-for="site in usage.sites" :key="site.host" class="website-row">
      <span>{{ site.host }}</span
      ><strong>{{ duration(site.elapsed, true) }}</strong>
    </div>
  </details>
</template>
<style scoped>
.website-summary {
  margin: 20px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}
summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  padding: 18px;
  cursor: pointer;
}
summary::before {
  content: '▸';
  color: var(--muted);
}
details[open] > summary::before {
  content: '▾';
}
summary > span {
  flex: 1;
  min-width: 150px;
}
strong {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
small,
p {
  color: var(--muted);
  font-size: 13px;
}
p {
  margin: 0 18px 14px;
}
.website-row {
  display: flex;
  gap: 20px;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
</style>
