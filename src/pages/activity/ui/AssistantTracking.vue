<script setup lang="ts">
import { computed } from 'vue';
import { Mic, Pause, Play } from 'lucide-vue-next';
import type { TrackerStatus } from '../../../shared/api/trackingContracts.ts';
const props = defineProps<{ status: TrackerStatus | null; now: number }>();
const assistant = computed(() => {
  const item = props.status?.assistant;
  return item && props.now >= item.timestamp && props.now - item.timestamp < 15000 ? item : null;
});
const active = computed(() => {
  const item = assistant.value;
  if (!item?.active) return false;
  if (item.recording) return true;
  return item.interaction_at === undefined
    ? item.idle_ms < 300000
    : item.interaction_at > 0 &&
        props.now >= item.interaction_at &&
        props.now - item.interaction_at < 300000;
});
</script>
<template>
  <div v-if="assistant" class="assistant-item" role="status">
    <Mic v-if="assistant.recording" :size="17" />
    <Play v-else-if="active" :size="17" /><Pause v-else :size="17" />
    <div>
      <strong>{{ assistant.title }}</strong>
      <small>{{
        active
          ? assistant.recording
            ? 'Запись голоса, время учитывается'
            : 'Время учитывается'
          : '5 минут без действий, учёт приостановлен'
      }}</small>
    </div>
  </div>
</template>
<style scoped>
.assistant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.assistant-item div {
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
