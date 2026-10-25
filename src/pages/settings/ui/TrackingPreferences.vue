<script setup lang="ts">
import { idleMinutes } from '../../../shared/lib/trackingIdle.ts';
const minutes = defineModel<number>({ required: true });
defineProps<{ busy: boolean; supported: boolean }>();
const emit = defineEmits<{ save: [] }>();
const options = Array.from({ length: 30 }, (_, index) => index + 1);
</script>
<template>
  <details class="tracking-details idle-settings">
    <summary>Пауза при бездействии</summary>
    <p class="muted">
      Если в активном чате или приложении нет действий дольше этого времени, учёт приостанавливается. При
      смене вкладки или окна учёт прекращается сразу. Видео и голосовые каналы используют своё состояние.
    </p>
    <p v-if="!supported" class="muted">Обнови Activity Tracker, чтобы менять время бездействия.</p>
    <form v-else class="idle-form" @submit.prevent="emit('save')">
      <label
        >Время без действий<select v-model.number="minutes">
          <option v-for="value in options" :key="value" :value="value">
            {{ idleMinutes(value * 60000) }}
          </option>
        </select></label
      >
      <button
        class="button primary"
        :disabled="busy"
        title="Сохранить время бездействия в Activity Tracker. Настройка сохраняется после перезапуска"
      >
        Сохранить время бездействия
      </button>
    </form>
  </details>
</template>
<style scoped>
.idle-settings {
  margin: 0 24px 24px;
}
.idle-form {
  display: grid;
  gap: 16px;
  justify-items: start;
  grid-template-columns: minmax(0, 1fr);
}
label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  min-width: 0;
  width: 100%;
}
select {
  min-width: 0;
  width: 100%;
  max-width: 240px;
}
</style>
