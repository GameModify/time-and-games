<script setup lang="ts">
import { Activity, RefreshCw } from 'lucide-vue-next';
import type { Category } from '../../../shared/api/contracts.ts';
import CheckboxField from '../../../shared/ui/CheckboxField.vue';
import TrackingInboxRow from './TrackingInboxRow.vue';
import WorkRules from './WorkRules.vue';
import TrackingRules from './TrackingRules.vue';
import { useTracking } from '../model/useTracking.ts';
defineProps<{ categories: Category[] }>();
const { model, actions } = useTracking();
</script>
<template>
  <section class="panel settings-panel tracking-panel">
    <div class="section-heading">
      <div>
        <h2>Автоматический учёт</h2>
        <p class="muted">
          Подключи отдельный Activity Tracker. Он собирает активность независимо от открытого сайта.
        </p>
      </div>
      <Activity :size="24" class="purple-text" />
    </div>
    <p v-if="model.error" class="alert error" role="alert">{{ model.error }}</p>
    <p v-if="model.notice" class="tracking-notice" role="status">{{ model.notice }}</p>
    <form class="tracking-connection" @submit.prevent="actions.save">
      <CheckboxField v-model="model.form.enabled" label="Подключить сервис трекинга" />
      <div class="tracking-fields">
        <label
          >Адрес сервиса<input
            v-model="model.form.endpoint"
            type="url"
            required
            placeholder="http://127.0.0.1:3536"
        /></label>
        <label
          >Ключ подключения<input
            v-model="model.token"
            type="password"
            autocomplete="off"
            :placeholder="
              model.state?.settings.token_set
                ? 'Ключ сохранён'
                : 'Ключ read из локальных настроек трекера'
            "
        /></label>
      </div>
      <p class="subtle-note">
        Сайт запускается и работает при отключённом трекере. Отключение подключения останавливает импорт;
        сбором управляет отдельная кнопка ниже.
      </p>
      <CheckboxField
        v-model="model.form.auto_import"
        label="Автоматически добавлять завершённые интервалы с настроенной категорией"
      />
      <details class="tracking-details">
        <summary>Связь меток с категориями</summary>
        <p class="muted">
          Например: coding → Кодинг, projects → Проекты, communication → Общение, video → YouTube /
          Видео. Неизвестные занятия остаются на проверке. Для папки научных документов используй метку
          science, для остальных документов documents, для игр games. Обычные сайты используют web и по
          умолчанию не относятся к рабочему времени.
        </p>
        <div v-for="(mapping, index) in model.form.mappings" :key="index" class="tracking-mapping">
          <label>Метка<input v-model="mapping.activity" maxlength="80" placeholder="coding" /></label
          ><label
            >Категория<select v-model="mapping.category_id">
              <option value="">Выбери категорию</option>
              <option v-for="entry in categories" :key="entry.id" :value="entry.id">
                {{ entry.name }}
              </option>
            </select></label
          ><button
            type="button"
            class="text-button danger"
            @click="model.form.mappings.splice(index, 1)"
          >
            Убрать
          </button>
        </div>
        <button type="button" class="button secondary" @click="actions.addMapping">
          Добавить соответствие
        </button>
      </details>
      <div class="backup-actions">
        <button class="button primary" :disabled="model.busy">Сохранить подключение</button
        ><button
          type="button"
          class="button secondary"
          :disabled="model.busy || !model.state?.settings.enabled"
          @click="actions.sync"
        >
          <RefreshCw :size="16" />Синхронизировать
        </button>
      </div>
    </form>
    <div v-if="model.state?.settings.enabled" class="tracking-status" role="status">
      <strong>{{ model.state.connected ? 'Сервис подключён' : 'Нет связи с сервисом' }}</strong
      ><span v-if="model.state.error">{{ model.state.error }}</span>
      <template v-if="model.state.status"
        ><span>Сбор: {{ model.state.status.paused ? 'приостановлен' : 'включён' }}</span
        ><span
          >Окна Windows:
          {{
            model.state.status.desktop_error
              ? 'ошибка сборщика'
              : model.state.status.desktop_available
                ? 'сборщик доступен'
                : 'недоступны на этой системе'
          }}</span
        ><span
          >Chrome:
          {{
            model.state.status.browser_at && Date.now() - model.state.status.browser_at < 30000
              ? 'события поступают' +
                (model.state.status.browser_version ? ' · ' + model.state.status.browser_version : '')
              : 'ожидаем расширение'
          }}</span
        ><span v-if="model.state.status.voice"
          >Discord:
          {{
            model.state.status.voice.state === 'connected'
              ? 'подключение к голосовому каналу подтверждено'
              : model.state.status.voice.state === 'disconnected'
                ? 'приложение не запущено'
                : 'подключение не подтверждено, голосовое время не учитывается'
          }}</span
        >
        <span
          >Чаты и документы: пауза после 5 минут без действий. Для чатов включи проверку действий в
          настройках расширения.</span
        >
        <button class="button secondary" :disabled="model.busy" @click="actions.pause">
          {{ model.state.status.paused ? 'Продолжить сбор' : 'Приостановить сбор' }}
        </button></template
      >
    </div>
    <WorkRules
      v-if="model.state?.connected"
      v-model="model.rules"
      :busy="model.busy"
      :status="model.state.status"
      :categories="categories"
      :mappings="model.form.mappings"
      @save="actions.saveRules"
    />
    <TrackingRules
      v-if="model.state?.connected"
      v-model="model.rules"
      :busy="model.busy"
      @add="actions.addRule"
      @folder="actions.addFolderRule"
      @save="actions.saveRules"
    />
    <details class="tracking-details" :open="model.items.length > 0">
      <summary>
        Проверить интервалы <span class="muted">({{ model.items.length }})</span>
      </summary>
      <p class="muted">
        Добавляй нужное в таймлайн. Время, уже записанное в выбранной категории, повторно не добавляется.
      </p>
      <p v-if="!model.items.length" class="muted">Новых завершённых интервалов пока нет.</p>
      <TrackingInboxRow
        v-for="item in model.items"
        :key="item.device_id + item.id"
        :item="item"
        :categories="categories"
        :mappings="model.form.mappings"
        :busy="model.busy"
        @import="actions.importItem"
        @ignore="actions.ignore"
      />
    </details>
  </section>
</template>
<style scoped>
.tracking-connection,
.tracking-status {
  display: grid;
  gap: 18px;
}
.tracking-connection {
  padding: 0 24px 24px;
}
.tracking-panel > .tracking-details {
  margin: 0 24px 24px;
}
.tracking-fields,
.tracking-mapping {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: end;
}
.tracking-mapping {
  grid-template-columns: 1fr 1fr auto;
  margin: 18px 0;
}
.tracking-panel label:not(.checkbox-field) {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 14px;
}
.tracking-panel input:not([type='checkbox']),
.tracking-panel select {
  width: 100%;
  min-width: 0;
}
.tracking-details {
  margin-top: 22px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.tracking-details summary {
  cursor: pointer;
  font-size: 16px;
  color: var(--text);
}
.tracking-details p {
  margin: 16px 0;
}
.tracking-status {
  margin: 0 24px 24px;
  padding: 18px;
  border-radius: 10px;
  background: var(--surface);
  font-size: 14px;
}
.tracking-notice {
  margin: 0 24px 18px;
  color: var(--accent-text);
}
:deep(.tracking-rule) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px;
  margin: 16px 0;
}
:deep(.tracking-rule label:not(.checkbox-field)) {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
:deep(.tracking-inbox-row) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px auto;
  align-items: center;
  gap: 16px;
  border-top: 1px solid var(--line);
  padding: 18px 0;
}
:deep(.tracking-interval-info) {
  display: grid;
  gap: 6px;
  min-width: 0;
}
:deep(.tracking-interval-info strong) {
  overflow-wrap: anywhere;
  font-size: 15px;
  font-weight: 500;
}
:deep(.tracking-interval-info span) {
  font-size: 13px;
}
:deep(.tracking-row-actions) {
  display: flex;
  align-items: center;
  gap: 12px;
}
@media (max-width: 760px) {
  .tracking-fields,
  .tracking-mapping,
  :deep(.tracking-rule),
  :deep(.tracking-inbox-row) {
    grid-template-columns: 1fr;
  }
}
</style>
