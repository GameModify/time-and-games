<script setup lang="ts">
const minutes = defineModel<number>({ required: true });
defineProps<{ busy: boolean; supported: boolean }>();
const emit = defineEmits<{ save: [] }>();
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
      <label class="idle-minutes" for="inactivity-minutes"
        >Время бездействия, мин
        <input
          id="inactivity-minutes"
          v-model.number="minutes"
          type="number"
          inputmode="numeric"
          min="1"
          max="30"
          step="1"
          required
          :disabled="busy"
          placeholder="Например, 5"
          aria-describedby="inactivity-minutes-help"
        />
      </label>
      <small id="inactivity-minutes-help" class="muted">От 1 до 30 минут.</small>
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
.idle-minutes {
  display: grid;
  gap: 8px;
  color: var(--muted);
  min-width: 0;
}
.idle-minutes input {
  width: 140px;
  max-width: 100%;
  min-width: 0;
}
</style>
