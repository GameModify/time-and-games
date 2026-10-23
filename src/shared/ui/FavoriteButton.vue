<script setup lang="ts">
import { Heart } from 'lucide-vue-next';
defineProps<{ active: boolean; name: string; disabled?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>
<template>
  <button
    type="button"
    class="favorite-button"
    :class="{ selected: active }"
    :disabled="disabled"
    :aria-pressed="active"
    :aria-label="`${active ? 'Убрать из избранного' : 'В избранное'}: ${name}`"
    :title="active ? 'Убрать из избранного' : 'В избранное'"
    @click.stop="emit('toggle')"
  >
    <Heart :size="18" :fill="active ? 'currentColor' : 'none'" />
  </button>
</template>
<style scoped>
.favorite-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid #ffffff50;
  border-radius: 8px;
  background: #15131de8;
  color: #fff;
  padding: 0;
}
.favorite-button.selected {
  color: #ff9bbf;
  border-color: #ff9bbf90;
}
.favorite-button:hover {
  background: #33263e;
}
</style>
