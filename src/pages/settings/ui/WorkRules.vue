<script setup lang="ts">
import { idleMinutes } from '../../../shared/lib/trackingIdle.ts';
import { computed, reactive, ref } from 'vue';
import type {
  TrackerRule,
  TrackerStatus,
  TrackingConnection,
} from '../../../shared/api/trackingContracts.ts';
import type { Category } from '../../../shared/api/contracts.ts';
import { workRule } from '../model/workRules.ts';
import type { WorkRuleDraft } from '../model/workRules.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
const rules = defineModel<TrackerRule[]>({ required: true });
const props = defineProps<{
  busy: boolean;
  idleTimeout: number;
  status: TrackerStatus | null;
  categories: Category[];
  mappings: TrackingConnection['mappings'];
}>();
const emit = defineEmits<{ save: [] }>();
const error = ref('');
const workMappings = computed(() =>
  props.mappings.filter((mapping) =>
    props.categories.some((category) => category.id === mapping.category_id && category.is_work),
  ),
);
const draft = reactive<WorkRuleDraft>({
  source: 'app',
  value: '',
  name: '',
  project: '',
  activity: 'projects',
});
function add(): void {
  try {
    const rule = workRule(draft, rules.value);
    rules.value = [...rules.value.filter((item) => item.id !== rule.id), rule];
    error.value = '';
    emit('save');
  } catch (cause) {
    error.value = errorMessage(cause);
  }
}
function currentApp(): void {
  draft.source = 'app';
  draft.value = props.status?.foreground?.app ?? '';
}
function categoryName(id: string): string {
  return props.categories.find((category) => category.id === id)?.name ?? id;
}
</script>
<template>
  <details class="work-rules tracking-details">
    <summary>Рабочие инструменты и проекты</summary>
    <p class="muted">
      Один раз свяжи приложение, сайт или обучающий канал с занятием. Проект необязателен. Сайты
      учитываются только в активной вкладке, приложения в активном окне. Пауза бездействия:
      {{ idleMinutes(idleTimeout) }}. Видео учитывается по воспроизведению.
    </p>
    <form class="work-rule-form" @submit.prevent="add">
      <label
        >Что определять<select v-model="draft.source">
          <option value="app">Приложение Windows</option>
          <option value="host">Сайт</option>
          <option value="media_creator">Канал YouTube</option>
          <option value="media_id">Видео YouTube</option>
          <option value="title">Слова в названии видео</option>
        </select></label
      >
      <label
        >Приложение, адрес или название<input
          v-model="draft.value"
          required
          maxlength="200"
          :placeholder="
            draft.source === 'app'
              ? 'Code.exe'
              : draft.source === 'media_creator'
                ? 'https://www.youtube.com/@channel'
                : 'Адрес или значение'
          "
      /></label>
      <label
        >Название правила<input
          v-model="draft.name"
          maxlength="100"
          placeholder="Например, Уроки программирования"
      /></label>
      <label
        >Занятие<select v-model="draft.activity">
          <option v-for="mapping in workMappings" :key="mapping.activity" :value="mapping.activity">
            {{ categoryName(mapping.category_id) }}
          </option>
        </select></label
      >
      <label
        >Проект, если есть<input
          v-model="draft.project"
          maxlength="100"
          placeholder="Например, Time &amp; Games"
      /></label>
      <div class="backup-actions">
        <button
          class="button primary"
          :disabled="busy || !workMappings.length"
          title="Сохранить связь инструмента с рабочим занятием и проектом для следующих событий"
        >
          Сохранить правило</button
        ><button
          v-if="status?.foreground?.app"
          type="button"
          class="button secondary"
          :disabled="busy"
          title="Вставить имя приложения из текущего активного окна Windows"
          @click="currentApp"
        >
          Подставить текущее приложение
        </button>
      </div>
      <p v-if="error" class="alert error" role="alert">{{ error }}</p>
    </form>
    <p class="muted">
      Правило сайта не меняет категорию воспроизводимого видео. Для обучения выбери канал, конкретное
      видео или слова в его названии. Изменения действуют на следующие отрезки; все правила можно
      изменить ниже.
    </p>
  </details>
</template>
<style scoped>
.work-rules {
  margin: 24px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
h3 {
  font-size: 18px;
  font-weight: 500;
}
.work-rule-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 20px 0;
}
label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}
input,
select {
  width: 100%;
  min-width: 0;
}
.backup-actions,
.alert {
  grid-column: 1 / -1;
}
@media (max-width: 760px) {
  .work-rule-form {
    grid-template-columns: 1fr;
  }
}
</style>
