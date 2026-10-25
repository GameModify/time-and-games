<script setup lang="ts">
import type { TrackingState } from '../../../shared/api/trackingContracts.ts';
import { idleMinutes, idleTimeout } from '../../../shared/lib/trackingIdle.ts';
defineProps<{ state: TrackingState; busy: boolean }>();
const emit = defineEmits<{ pause: [] }>();
</script>
<template>
  <div class="tracking-status" role="status">
    <strong>{{ state.connected ? 'Сервис подключён' : 'Нет связи с сервисом' }}</strong>
    <span v-if="state.error">{{ state.error }}</span>
    <template v-if="state.status">
      <span
        >Сбор {{ state.status.paused ? 'приостановлен' : 'включён' }} · Пауза бездействия:
        {{ idleMinutes(idleTimeout(state.status)) }}</span
      >
      <button
        class="button secondary"
        :disabled="busy"
        title="Остановить или возобновить сбор всех событий в Activity Tracker. Сохранённые записи останутся"
        @click="emit('pause')"
      >
        {{ state.status.paused ? 'Продолжить сбор' : 'Приостановить сбор' }}
      </button>
      <details class="collector-status">
        <summary>Состояние сборщиков</summary>
        <span
          >Окна Windows:
          {{
            state.status.desktop_error
              ? 'ошибка сборщика'
              : state.status.desktop_available
                ? 'сборщик доступен'
                : 'недоступны на этой системе'
          }}</span
        >
        <span
          >Chrome:
          {{
            state.status.browser_at && Date.now() - state.status.browser_at < 30000
              ? 'события поступают' +
                (state.status.browser_version ? ' · ' + state.status.browser_version : '')
              : 'ожидаем расширение'
          }}</span
        >
        <span v-if="state.status.voice"
          >Discord:
          {{
            state.status.voice.state === 'connected'
              ? 'подключение к голосовому каналу подтверждено'
              : state.status.voice.state === 'disconnected'
                ? 'приложение не запущено'
                : 'подключение не подтверждено, голосовое время не учитывается'
          }}</span
        >
        <span>Для чатов включи учёт действий в настройках расширения.</span>
      </details>
    </template>
  </div>
</template>
<style scoped>
.tracking-status {
  display: grid;
  gap: 12px;
  margin: 0 24px 24px;
  padding: 18px;
  border-radius: 10px;
  background: var(--surface);
  font-size: 14px;
}
.collector-status {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
summary {
  cursor: pointer;
}
.collector-status span {
  display: block;
  margin-top: 12px;
}
</style>
