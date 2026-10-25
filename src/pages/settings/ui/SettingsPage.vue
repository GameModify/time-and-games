<script setup lang="ts">
import type { Category } from '../../../shared/api/contracts.ts';
import type { EditorView } from '../../../features/record-editor/index.ts';
import type { ThemeView } from '../../../features/appearance/index.ts';

import { toRefs } from 'vue';
import TrackingPanel from './TrackingPanel.vue';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Gamepad2,
  Layers,
  Moon,
  Pencil,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-vue-next';
import { activityIcons as icons } from '../../../entities/activity/index.ts';
const props = defineProps<{
  categories: Category[];
  groupNames: string[];
  editor: EditorView;
  appearance: ThemeView;
}>();
const { categories, groupNames } = toRefs(props);
const { theme, setTheme } = toRefs(props.appearance);
const { editCategory, remove, readBackup, open } = toRefs(props.editor);
</script>
<template>
  <details class="panel settings-panel settings-disclosure appearance-panel">
    <summary class="section-heading">
      <div>
        <h2>Оформление</h2>
        <p class="muted">Выбери тему, в которой тебе комфортно. Выбор сохранится в этом браузере.</p>
      </div>
    </summary>
    <div class="theme-options" role="group" aria-label="Тема оформления">
      <button
        :class="['theme-option', { selected: theme === 'dark' }]"
        :aria-pressed="theme === 'dark'"
        @click="setTheme('dark')"
      >
        <Moon :size="21" /><span>Тёмная<small>Для вечернего фокуса</small></span
        ><Check v-if="theme === 'dark'" :size="18" /></button
      ><button
        :class="['theme-option', { selected: theme === 'light' }]"
        :aria-pressed="theme === 'light'"
        @click="setTheme('light')"
      >
        <Sun :size="21" /><span>Светлая<small>Больше воздуха и света</small></span
        ><Check v-if="theme === 'light'" :size="18" />
      </button>
    </div>
  </details>
  <TrackingPanel :categories="categories" />
  <details class="panel settings-panel settings-disclosure">
    <summary class="section-heading">
      <div>
        <h2>Твои категории</h2>
        <p class="muted">Группируй занятия и выбирай, что считать работой.</p>
      </div>
    </summary>
    <div class="backup-actions">
      <button class="button secondary" @click="editCategory()">
        <Plus :size="16" />Добавить категорию
      </button>
    </div>
    <div v-for="group in groupNames" :key="group" class="category-group">
      <h3>{{ group }}</h3>
      <div
        v-for="c in categories.filter((c) => c.group_name === group)"
        :key="c.id"
        class="category-setting"
      >
        <span class="category-symbol" :style="{ color: c.color, background: `${c.color}18` }"
          ><component :is="icons[c.icon] || Layers" :size="18" /></span
        ><strong>{{ c.name }}</strong
        ><span v-if="c.is_work" class="work-badge">Работа</span
        ><button class="icon-button" :aria-label="`Изменить ${c.name}`" @click="editCategory(c)">
          <Pencil :size="16" /></button
        ><button
          class="icon-button danger"
          :aria-label="`Удалить ${c.name}`"
          @click="remove('categories', c)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>
  </details>
  <details class="panel settings-panel settings-disclosure">
    <summary class="section-heading">
      <div>
        <h2>Данные под твоим контролем</h2>
        <p class="muted">Всё хранится локально в SQLite. Сохраняй резервные копии.</p>
      </div>
      <ShieldCheck :size="24" class="green-text" />
    </summary>
    <div class="backup-actions">
      <a class="button secondary" href="/api/export" download
        ><ArrowDownToLine :size="17" />Скачать резервную копию</a
      ><label class="button secondary file-button"
        ><ArrowUpFromLine :size="17" />Восстановить копию из файла<input
          type="file"
          accept=".json,application/json"
          @change="readBackup"
      /></label>
    </div>
    <p class="subtle-note">Восстановление заменяет текущие записи. Перед ним сохрани экспорт.</p>
  </details>
  <details class="panel settings-panel settings-disclosure">
    <summary class="section-heading">
      <div>
        <h2>Сброс данных</h2>
        <p class="muted">
          Удалить все записи времени, игры, фильмы, сериалы и свои категории. Стандартные категории
          появятся заново.
        </p>
      </div>
    </summary>
    <div class="backup-actions">
      <button class="button danger-button" @click="open('reset', { confirmation: '' })">
        <Trash2 :size="17" />Сбросить данные
      </button>
    </div>
    <p class="subtle-note">
      Перед сбросом сохрани резервную копию. Отменить сброс можно только восстановлением из файла.
    </p>
  </details>
  <section class="panel settings-panel about-panel">
    <span class="brand-icon"><Gamepad2 :size="25" /></span>
    <div>
      <h2>Время и игры <span class="muted">v0.1.0</span></h2>
      <p class="muted">Vue 3 · SQLite · Твоё личное пространство</p>
      <p class="subtle-note">ИИ и голосовой ввод - следующий этап.</p>
    </div>
  </section>
</template>
