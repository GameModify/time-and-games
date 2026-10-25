<script setup lang="ts">
import { Radio } from 'lucide-vue-next';
import type { Category } from '../../../shared/api/contracts.ts';
import type { ActivityTrack } from '../../../entities/activity/index.ts';
const props = defineProps<{ items: ActivityTrack[]; categories: Category[] }>();
defineEmits<{ select: [item: ActivityTrack] }>();
function category(id: string): Category | undefined {
  return props.categories.find((item) => item.id === id);
}
</script>
<template>
  <section class="current-activities" aria-label="Сейчас учитывается">
    <h3><Radio :size="16" />Сейчас</h3>
    <div v-if="items.length" class="current-list">
      <button
        v-for="item in items"
        :key="item.id"
        :style="{ '--current-color': category(item.category)?.color }"
        :title="item.title || category(item.category)?.name"
        @click="$emit('select', item)"
      >
        <i aria-hidden="true" /><span>{{ item.title || category(item.category)?.name }}</span>
      </button>
    </div>
    <p v-else>Сейчас нет занятий с учётом времени.</p>
  </section>
</template>
<style scoped>
.current-activities {
  padding: 14px 20px;
  display: flex;
  align-items: center;
  min-height: 64px;
  gap: 12px;
  background: var(--panel);
  border-block: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 6;
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  line-height: 1.5;
  flex-shrink: 0;
  color: var(--success-text);
}
.current-list {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  max-width: 100%;
  text-align: left;
}
i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--current-color, var(--success-text));
  flex: 0 0 7px;
}
button > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
  font-size: 14px;
}

p {
  margin: 0;
  line-height: 1.5;
  color: var(--muted);
  font-size: 13px;
}
button:focus-visible {
  outline: 2px solid var(--accent-text);
  outline-offset: 3px;
}
@media (max-width: 700px) {
  .current-activities {
    padding: 14px;
  }
}
</style>
