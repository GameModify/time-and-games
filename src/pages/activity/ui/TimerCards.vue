<script setup lang="ts">
import { Pause, Play, Pencil, Square } from 'lucide-vue-next';
import type { Timer, Session } from '../../../shared/api/contracts.ts';
import type { WorkspaceView } from '../../../features/workspace/index.ts';
import { duration } from '../../../shared/lib/date.ts';
import { clock } from '../../../shared/lib/format.ts';
const props = defineProps<{ model: WorkspaceView }>();
defineEmits<{ edit: [session: Session] }>();
function label(timer: Timer): string {
  return (
    timer.title || props.model.gameName(timer.game_id) || props.model.category(timer.category_id).name
  );
}
function elapsed(timer: Timer): number {
  return timer.elapsed_before + Math.max(0, (timer.end_at ?? props.model.now) - timer.start_at);
}
</script>
<template>
  <div v-if="model.active.length || model.paused.length" class="running-list">
    <div
      v-for="timer in model.active"
      :key="timer.id"
      class="running-row"
      :style="{ '--activity': model.category(timer.category_id).color }"
    >
      <span class="running-dot" />
      <div class="running-name">
        <strong>{{ label(timer) }}</strong
        ><small>Идёт с {{ clock(timer.start_at) }}</small>
      </div>
      <span class="timer-digits">{{ duration(elapsed(timer), true) }}</span>
      <button class="icon-button" aria-label="Изменить активную запись" @click="$emit('edit', timer)">
        <Pencil :size="16" />
      </button>
      <button class="button secondary" :disabled="model.busy" @click="model.pauseTimer(timer)">
        <Pause :size="14" />Пауза
      </button>
      <button class="stop-button" :disabled="model.busy" @click="model.stop(timer)">
        <Square :size="12" fill="currentColor" />Стоп
      </button>
    </div>
    <div
      v-for="timer in model.paused"
      :key="timer.timer_id"
      class="running-row paused-row"
      :style="{ '--activity': model.category(timer.category_id).color }"
    >
      <Pause :size="16" class="muted" />
      <div class="running-name">
        <strong>{{ label(timer) }}</strong
        ><small>На паузе · перерыв не учитывается</small>
      </div>
      <span class="timer-digits">{{ duration(elapsed(timer), true) }}</span>
      <button
        class="button secondary"
        :disabled="model.busy || model.activeIds.has(timer.category_id)"
        @click="model.resumeTimer(timer)"
      >
        <Play :size="14" />Продолжить
      </button>
      <button class="stop-button" :disabled="model.busy" @click="model.finishPaused(timer)">
        <Square :size="12" fill="currentColor" />Завершить
      </button>
    </div>
    <button
      v-if="model.active.length > 1"
      class="text-button stop-all"
      :disabled="model.busy"
      @click="model.stopAll"
    >
      Остановить все активные
    </button>
  </div>
</template>
<style scoped>
.running-row {
  flex-wrap: wrap;
  gap: 12px;
}
.paused-row {
  background: var(--surface);
}
.paused-row .timer-digits {
  color: var(--muted);
}
</style>
