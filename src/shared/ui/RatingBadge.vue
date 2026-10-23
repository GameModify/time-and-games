<script setup lang="ts">
import { Star } from 'lucide-vue-next';
import { ratingTone } from '../lib/rating.ts';
defineProps<{ value: number }>();
</script>
<template>
  <span
    class="rating-badge"
    :data-tone="ratingTone(value)"
    :aria-label="`Оценка ${value.toLocaleString('ru-RU')} из 10`"
  >
    <Star :size="14" fill="currentColor" />{{ value.toLocaleString('ru-RU') }}
  </span>
</template>
<style scoped>
.rating-badge {
  --badge-color: #e3e5ef;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
  border-radius: 6px;
  background: #15131de8;
  color: var(--badge-color);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}
.rating-badge[data-tone='gold'] {
  --badge-color: #f0c86a;
}
.rating-badge[data-tone='red'] {
  --badge-color: #ff939c;
}
</style>
