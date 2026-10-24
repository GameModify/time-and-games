<script setup lang="ts">
import type { TrackerRule } from '../../../shared/api/trackingContracts.ts';
import CheckboxField from '../../../shared/ui/CheckboxField.vue';
const rules = defineModel<TrackerRule[]>({ required: true });
defineProps<{ busy: boolean }>();
const emit = defineEmits<{ add: []; save: []; folder: [] }>();
</script>
<template>
  <details class="tracking-details">
    <summary>Правила определения занятий</summary>
    <p class="muted">
      Правило связывает приложение, адрес или заголовок с меткой занятия. При совпадении нескольких
      правил используется наибольший приоритет. Изменения действуют на новые интервалы.
    </p>
    <div v-for="(rule, index) in rules" :key="rule.id" class="tracking-rule">
      <label>Название<input v-model="rule.name" maxlength="100" /></label>
      <label
        >Проверять<select v-model="rule.field">
          <option value="app">Приложение</option>
          <option value="host">Сайт</option>
          <option value="url">Адрес страницы</option>
          <option value="title">Заголовок</option>
          <option value="kind">Тип события: focus / media / voice</option>
          <option value="resource_id">Путь документа или идентификатор ресурса</option>
        </select></label
      >
      <label
        >Условие<select v-model="rule.operator">
          <option value="contains">Содержит</option>
          <option value="equals">Совпадает</option>
          <option value="within">В папке и подпапках</option>
        </select></label
      >
      <label
        >Значение<input v-model="rule.value" maxlength="200" placeholder="Например, Code.exe"
      /></label>
      <label
        >Метка занятия<input v-model="rule.activity" maxlength="80" placeholder="Например, coding"
      /></label>
      <label>Приоритет<input v-model.number="rule.priority" type="number" min="0" max="1000" /></label>
      <CheckboxField v-model="rule.enabled" label="Включено" />
      <button class="text-button danger" :disabled="busy" @click="rules.splice(index, 1)">
        Удалить правило
      </button>
    </div>
    <div class="backup-actions">
      <button class="button secondary" :disabled="busy" @click="emit('folder')">
        Добавить папку документов
      </button>
      <button class="button secondary" :disabled="busy" @click="emit('add')">Добавить правило</button
      ><button class="button primary" :disabled="busy" @click="emit('save')">Сохранить правила</button>
    </div>
  </details>
</template>
