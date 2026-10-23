<script setup>
import { toRefs } from 'vue';
import { ArrowDownToLine, Gamepad2, LoaderCircle, Plus, Search, Trash2, X } from 'lucide-vue-next';
import { duration } from '../../../shared/lib/date.js';
import { statuses } from '../../../entities/game/index.js';
import { createBackdropDismiss } from '../lib/backdrop.js';
const props = defineProps({ editor: { type: Object, required: true } });
const {
  modal,
  modalElement,
  form,
  isGameSession,
  modalError,
  saving,
  steamQuery,
  steamResults,
  steamSearched,
  steamBusy,
  steamId,
  steamKey,
  importReport,
  steamPath,
  modalTitles,
  close,
  save,
  remove,
  steamSearch,
  importSteam,
  categories,
  groupNames,
  games,
  gameName,
  syncSessionDuration,
  setSessionDuration,
} = toRefs(props.editor);
const backdrop = createBackdropDismiss(() => props.editor.close());
</script>
<template>
  <div
    v-if="modal"
    class="modal-backdrop"
    @pointerdown="backdrop.down"
    @pointerup="backdrop.up"
    @pointercancel="backdrop.cancel"
  >
    <section
      ref="modalElement"
      class="modal"
      :class="{ 'wide-modal': modal === 'steam' }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <header class="modal-header">
        <h2 id="modal-title">{{ modalTitles[modal] }}</h2>
        <button class="icon-button" aria-label="Закрыть" :disabled="saving" @click="close">
          <X :size="20" />
        </button>
      </header>
      <div v-if="modalError" class="alert error" role="alert">{{ modalError }}</div>
      <form v-if="modal === 'session'" class="modal-form" @submit.prevent="save">
        <label
          >Название <span class="muted">необязательно</span
          ><input v-model="form.title" maxlength="160" placeholder="Например, работа над новым проектом"
        /></label>
        <fieldset>
          <legend>Занятие{{ form.id ? '' : ' - можно несколько' }}</legend>
          <div class="form-chips">
            <label
              v-for="c in categories"
              :key="c.id"
              :style="{ '--activity': c.color }"
              :class="['activity-chip', { selected: form.category_ids.includes(c.id) }]"
              ><input v-if="!form.id" v-model="form.category_ids" type="checkbox" :value="c.id" /><input
                v-else
                type="radio"
                name="category"
                :checked="form.category_ids[0] === c.id"
                @change="form.category_ids = [c.id]"
              /><span class="category-dot" :style="{ background: c.color }" />{{ c.name }}</label
            >
          </div>
        </fieldset>
        <div class="form-grid">
          <label
            >Начало<input
              v-model="form.start"
              type="datetime-local"
              required
              @change="syncSessionDuration" /></label
          ><label
            >Окончание<input v-model="form.end" type="datetime-local" @change="syncSessionDuration"
          /></label>
        </div>
        <fieldset class="duration-fields">
          <legend>Длительность</legend>
          <div class="form-grid">
            <label
              >Часы<input
                v-model="form.duration_hours"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                @input="setSessionDuration" /></label
            ><label
              >Минуты<input
                v-model="form.duration_minutes"
                type="number"
                min="0"
                max="59"
                step="1"
                placeholder="0"
                @input="setSessionDuration"
            /></label>
          </div>
        </fieldset>
        <p class="field-hint">
          Без окончания запись станет активным таймером. Для ночной сессии выбери следующую дату
          окончания.
        </p>
        <label v-if="isGameSession || form.game_id"
          >Во что играл<select v-model="form.game_id">
            <option value="">Игра не выбрана</option>
            <option v-for="g in games" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select></label
        ><label
          >Что удалось сделать?<textarea
            v-model="form.note"
            rows="3"
            maxlength="10000"
            placeholder="Результат, идеи и важные детали…"
          />
        </label>
        <p v-if="form.game_id" class="field-hint">
          Время этой записи будет учтено для игры «{{ gameName(form.game_id) }}».
        </p>
        <div class="modal-actions">
          <button
            v-if="form.id"
            type="button"
            class="button danger-button"
            :disabled="saving"
            @click="remove('sessions', form)"
          >
            <Trash2 :size="16" />Удалить</button
          ><button type="button" class="button secondary" :disabled="saving" @click="close">
            Отмена</button
          ><button class="button primary" :disabled="saving">
            <LoaderCircle v-if="saving" :size="16" class="spin" />Сохранить
          </button>
        </div>
      </form>
      <form v-else-if="modal === 'game'" class="modal-form" @submit.prevent="save">
        <label
          >Название игры<input
            v-model="form.name"
            required
            maxlength="160"
            placeholder="Во что будем играть?"
        /></label>
        <div v-if="!form.id" class="steam-search">
          <div class="search-field">
            <Search :size="16" /><input
              v-model="steamQuery"
              placeholder="Найти постер в Steam…"
              aria-label="Поиск в Steam"
              @keydown.enter.prevent="steamSearch"
            />
          </div>
          <button
            type="button"
            class="button secondary"
            :disabled="steamBusy || steamQuery.trim().length < 2"
            @click="steamSearch"
          >
            {{ steamBusy ? 'Ищу…' : 'Найти' }}
          </button>
        </div>
        <div v-if="!form.id && steamSearched" class="steam-results">
          <p v-if="!steamResults.length" class="muted">Ничего не найдено. Можно добавить вручную.</p>
          <button
            v-for="g in steamResults"
            :key="g.appid"
            type="button"
            class="steam-result"
            @click="
              form.name = g.name;
              form.poster = g.poster;
              form.steam_appid = g.appid;
              steamResults = [];
              steamSearched = false;
            "
          >
            <span>{{ g.name }}</span
            ><Plus :size="15" />
          </button>
        </div>
        <div class="form-grid">
          <label
            >Статус<select v-model="form.status">
              <option v-for="(label, id) in statuses" :key="id" :value="id">{{ label }}</option>
            </select></label
          ><label
            >Оценка<select v-model="form.rating">
              <option :value="null">Пока без оценки</option>
              <option v-for="n in 10" :key="n" :value="n">{{ n }} / 10</option>
            </select></label
          >
        </div>
        <label
          >Постер - ссылка HTTPS<input v-model="form.poster" type="url" placeholder="https://…"
        /></label>
        <div class="form-grid">
          <label>Начал играть<input v-model="form.started_at" type="date" /></label
          ><label
            >Прошёл<input v-model="form.completed_at" type="date" :min="form.started_at || undefined"
          /></label>
        </div>
        <fieldset class="duration-fields">
          <legend>Общее время игры - из Steam или вручную</legend>
          <div class="form-grid">
            <label
              >Часы<input
                v-model="form.playtime_hours"
                type="number"
                min="0"
                step="1"
                placeholder="0" /></label
            ><label
              >Минуты<input
                v-model="form.playtime_remainder"
                type="number"
                min="0"
                max="59"
                step="1"
                placeholder="0"
            /></label>
          </div>
        </fieldset>
        <p v-if="form.id" class="field-hint">
          По таймеру за всё время: {{ duration((form.tracked_minutes || 0) * 60000) }}. На карточке
          показывается большее из времени таймера и общего времени: они могут описывать одни и те же
          часы.
        </p>
        <label
          >Твои впечатления<textarea
            v-model="form.review"
            rows="3"
            maxlength="10000"
            placeholder="Что запомнилось?"
          />
        </label>
        <div class="modal-actions">
          <button
            v-if="form.id"
            type="button"
            class="button danger-button"
            :disabled="saving"
            @click="remove('games', form)"
          >
            <Trash2 :size="16" />Удалить</button
          ><button type="button" class="button secondary" :disabled="saving" @click="close">
            Отмена</button
          ><button class="button primary" :disabled="saving">
            {{ saving ? 'Сохраняю…' : 'Сохранить игру' }}
          </button>
        </div>
      </form>
      <form v-else-if="modal === 'category'" class="modal-form" @submit.prevent="save">
        <label>Название<input v-model="form.name" required maxlength="55" /></label
        ><label
          >Группа<input v-model="form.group_name" list="groups" required maxlength="40" /><datalist
            id="groups"
          >
            <option v-for="g in groupNames" :key="g" :value="g" /></datalist></label
        ><label>Цвет<input v-model="form.color" type="color" /></label
        ><label class="checkbox-label"
          ><input v-model="form.is_work" type="checkbox" />Учитывать как работу</label
        >
        <div class="modal-actions">
          <button type="button" class="button secondary" :disabled="saving" @click="close">Отмена</button
          ><button class="button primary" :disabled="saving">Сохранить</button>
        </div>
      </form>
      <div v-else-if="modal === 'steam'" class="modal-form">
        <div class="import-section">
          <h3>Установленные игры</h3>
          <p class="muted">Найдём библиотеки Steam на этом компьютере. Ключ и вход не нужны.</p>
          <label
            >Папка Steam <span class="muted">если установлена нестандартно</span
            ><input v-model="steamPath" placeholder="D:\Steam" /></label
          ><button class="button secondary" :disabled="saving" @click="importSteam(false)">
            <Gamepad2 :size="16" />{{ saving ? 'Загружаю…' : 'Найти установленные игры' }}
          </button>
        </div>
        <div class="import-section">
          <h3>Вся библиотека аккаунта</h3>
          <p class="muted">
            Нужны SteamID64 и Steam Web API Key. Список игр должен быть доступен для этого ключа. Ключ
            используется только для запроса и не сохраняется.
          </p>
          <label
            >SteamID64<input
              v-model="steamId"
              inputmode="numeric"
              pattern="[0-9]{17}"
              placeholder="17 цифр"
              autocomplete="off" /></label
          ><label
            >Steam Web API Key<input
              v-model="steamKey"
              type="password"
              autocomplete="off"
              placeholder="32 символа" /></label
          ><button
            class="button primary"
            :disabled="saving || !steamId || !steamKey"
            @click="importSteam(true)"
          >
            {{ saving ? 'Импортирую…' : 'Импортировать библиотеку' }}
          </button>
        </div>
        <p v-if="importReport" role="status" class="alert success">{{ importReport }}</p>
        <div class="modal-actions">
          <button class="button secondary" :disabled="saving" @click="close">Готово</button>
        </div>
      </div>
      <form v-else-if="modal === 'reset'" class="modal-form" @submit.prevent="save">
        <p class="alert error">
          Будут удалены все записи, включая активные таймеры, библиотека игр и твои категории.
        </p>
        <a class="button secondary" href="/api/export" download
          ><ArrowDownToLine :size="16" />Скачать резервную копию</a
        ><label
          >Для подтверждения введи СБРОСИТЬ<input
            v-model="form.confirmation"
            autocomplete="off"
            placeholder="СБРОСИТЬ"
        /></label>
        <div class="modal-actions">
          <button type="button" class="button secondary" :disabled="saving" @click="close">Отмена</button
          ><button class="button danger-button" :disabled="saving || form.confirmation !== 'СБРОСИТЬ'">
            Удалить все данные
          </button>
        </div>
      </form>
      <div v-else-if="modal === 'backup'" class="modal-form">
        <p>
          Будут восстановлены {{ form.data.categories.length }} категорий,
          {{ form.data.games.length }} игр и {{ form.data.sessions.length }} записей.
        </p>
        <p class="alert error">Текущие данные будут заменены. Сначала скачай резервную копию.</p>
        <a class="button secondary" href="/api/export" download
          ><ArrowDownToLine :size="16" />Скачать текущую копию</a
        >
        <div class="modal-actions">
          <button class="button secondary" :disabled="saving" @click="close">Отмена</button
          ><button class="button danger-button" :disabled="saving" @click="save">Заменить данные</button>
        </div>
      </div>
      <div v-else-if="modal === 'delete'" class="modal-form">
        <p>Удалить «{{ form.name }}»?</p>
        <p class="muted">
          {{
            form.resource === 'games'
              ? 'Связанные записи времени сохранятся без привязки к игре.'
              : form.resource === 'categories'
                ? 'Категорию с записями удалить нельзя. Сначала перенеси записи в другую категорию.'
                : 'Вернуть запись можно будет из резервной копии.'
          }}
        </p>
        <div class="modal-actions">
          <button class="button secondary" :disabled="saving" @click="close">Отмена</button
          ><button class="button danger-button" :disabled="saving" @click="save">Удалить</button>
        </div>
      </div>
    </section>
  </div>
</template>
