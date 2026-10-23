<script setup lang="ts">
import { Heart } from 'lucide-vue-next';
const value = defineModel<boolean>({ required: true });
defineProps<{ count: number }>();
</script>
<template>
  <div class="favorite-filter" role="group" aria-label="Отбор по избранному">
    <button type="button" :class="{ active: !value }" :aria-pressed="!value" @click="value = false">
      Все
    </button>
    <button type="button" :class="{ active: value }" :aria-pressed="value" @click="value = true">
      <Heart :size="15" :fill="value ? 'currentColor' : 'none'" />Избранное <span>{{ count }}</span>
    </button>
  </div>
</template>
<style scoped>
.favorite-filter {
  display: inline-flex;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 4px;
  background: var(--surface);
  width: fit-content;
}
button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
}
button.active {
  color: var(--accent-text);
  background: var(--accent-surface);
}
span {
  font-size: 12px;
}
</style>
