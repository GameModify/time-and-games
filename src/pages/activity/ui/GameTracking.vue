<script setup lang="ts">
import { computed } from 'vue';
import { Pause, Play } from 'lucide-vue-next';
import type { TrackerStatus } from '../../../shared/api/trackingContracts.ts';
const props = defineProps<{ status: TrackerStatus | null; now: number }>();
const game = computed(() => {
  const item = props.status?.game;
  return item && props.now >= item.timestamp && props.now - item.timestamp < 15000 ? item : null;
});
const inForeground = computed(() => props.status?.foreground?.resource_id === game.value?.resource_id);
</script>
<template>
  <div v-if="game" class="automatic-item">
    <Play v-if="game.active" :size="16" /><Pause v-else :size="16" />
    <div>
      <strong>{{ game.title }}</strong>
      <small v-if="!game.active">Игра неактивна, время не учитывается</small>
      <small v-else-if="inForeground">Игра в активном окне · учитывается</small>
      <small v-else>Игра в фоне · учёт на паузе</small>
    </div>
  </div>
</template>
<style scoped>
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
