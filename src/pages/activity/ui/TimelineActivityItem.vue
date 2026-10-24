<script setup lang="ts">
import { ref } from 'vue';
import { Focus } from 'lucide-vue-next';
import type { ActivityTrack } from '../../../entities/activity/index.ts';
import type { Session } from '../../../shared/api/contracts.ts';
import { duration } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
const props = defineProps<{ item: ActivityTrack; selected: boolean; fallback: string }>();
defineEmits<{ focus: [item: ActivityTrack]; edit: [session: Session] }>();
const open = ref(props.selected);
function toggle(event: Event): void {
  if (event.currentTarget instanceof HTMLDetailsElement) open.value = event.currentTarget.open;
}
</script>
<template>
  <article class="activity-item">
    <details :open="selected" @toggle="toggle">
      <summary>
        <span>{{ item.title || fallback }}</span
        ><strong>{{ duration(item.elapsed) }}</strong>
      </summary>
      <div v-if="open" class="item-content">
        <dl>
          <div>
            <dt>Учтено</dt>
            <dd>{{ duration(item.elapsed, true) }}</dd>
          </div>
          <div>
            <dt>Промежутки без учёта</dt>
            <dd>{{ duration(item.paused, true) }}</dd>
          </div>
        </dl>
        <p>{{ clock(item.start) }} - {{ clock(item.end) }} · отрезков: {{ item.segments.length }}</p>
        <button class="button secondary" @click="$emit('focus', item)">
          <Focus :size="15" />Показать на шкале
        </button>
        <div class="segments">
          <button
            v-for="segment in item.segments"
            :key="segment.session.id"
            :disabled="segment.session.tracking_live"
            @click="$emit('edit', segment.session)"
          >
            <span
              >{{ clock(segment.start) }} - {{ clock(segment.end)
              }}<small>{{ segment.session.title || fallback }}</small
              ><small v-if="segment.session.note">{{ segment.session.note }}</small></span
            >
            <span
              >{{ duration(segment.end - segment.start, true)
              }}<small>{{ segment.session.tracking_live ? 'Текущий отрезок' : 'Изменить' }}</small></span
            >
          </button>
        </div>
      </div>
    </details>
  </article>
</template>
<style scoped>
.activity-item {
  border-bottom: 1px solid var(--line);
}
summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 0;
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
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
  min-width: 0;
  overflow-wrap: anywhere;
}
strong {
  font-weight: 500;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.item-content {
  padding-bottom: 18px;
}
dl {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 28px;
  margin: 0 0 12px;
}
dt,
p {
  color: var(--muted);
  font-size: 13px;
}
dd {
  margin: 5px 0 0;
  font-variant-numeric: tabular-nums;
}
p {
  margin: 0 0 14px;
}
.segments {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}
.segments button {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 8px;
  padding: 12px;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.segments button:disabled {
  cursor: default;
}
.segments span {
  min-width: 0;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
.segments span:last-child {
  text-align: right;
  flex-shrink: 0;
}
small {
  display: block;
  color: var(--muted);
  margin-top: 5px;
  font-size: 12px;
}
summary:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent-text);
  outline-offset: 3px;
  border-radius: 4px;
}
@media (max-width: 420px) {
  .segments button {
    flex-wrap: wrap;
  }
  .segments span:last-child {
    text-align: left;
  }
}
</style>
