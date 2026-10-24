<script setup lang="ts">
import { computed, ref } from 'vue';
import { Gamepad2 } from 'lucide-vue-next';
import type { TrackerStatus } from '../../../shared/api/trackingContracts.ts';
import { gameApplicationSchema } from '../../../shared/api/trackingContracts.ts';
import { api } from '../../../shared/api/client.ts';
const props = defineProps<{ status: TrackerStatus | null; now: number }>();
const busy = ref(false),
  error = ref(''),
  saved = ref('');
const candidate = computed(() => {
  const item = props.status?.foreground;
  return item?.game_candidate &&
    item.resource_kind !== 'game' &&
    item.app !== saved.value &&
    props.now >= item.timestamp &&
    props.now - item.timestamp < 15000
    ? item
    : null;
});
async function remember(): Promise<void> {
  const item = candidate.value;
  if (!item || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const input = gameApplicationSchema.parse({
      app: item.app,
      title: (item.title || item.app).slice(0, 100),
    });
    await api('/tracking/game-app', 'POST', input);
    saved.value = item.app;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось сохранить игру';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div v-if="candidate" class="candidate">
    <Gamepad2 :size="18" />
    <div>
      <strong>{{ candidate.title || candidate.app }}</strong>
      <small
        >Полноэкранное приложение ·
        {{ candidate.monitor === 'secondary' ? 'второй монитор' : 'основной монитор' }}</small
      >
      <small>{{ candidate.app }} · Подтверди один раз, если это игра.</small>
    </div>
    <button class="button secondary" :disabled="busy" @click="remember">Это игра</button>
  </div>
  <p v-if="error" class="candidate-error" role="alert">{{ error }}</p>
</template>
<style scoped>
.candidate {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.candidate div {
  flex: 1;
  min-width: 170px;
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
.candidate-error {
  color: var(--danger);
}
</style>
