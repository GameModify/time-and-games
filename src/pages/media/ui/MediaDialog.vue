<script setup lang="ts">
import type { MediaLibraryView } from '../model/useMediaLibrary.ts';
import { computed, toRefs } from 'vue';
import { Film, LoaderCircle, Plus, Trash2, X, RefreshCw, ExternalLink } from 'lucide-vue-next';
import RatingInput from '../../../shared/ui/RatingInput.vue';
import SearchField from '../../../shared/ui/SearchField.vue';
import CheckboxField from '../../../shared/ui/CheckboxField.vue';
import { createBackdropDismiss } from '../../../shared/lib/backdrop.ts';
import { mediaStatuses } from '../../../entities/media/index.ts';
import { duration } from '../../../shared/lib/date.ts';
const props = defineProps<{ model: MediaLibraryView }>();
const {
  dialog,
  form,
  error,
  busy,
  catalogBusy,
  catalogQuery,
  catalogResults,
  catalogSearched,
  hours,
  minutes,
  seasons,
  seasonEpisodes,
  confirmingDelete,
  close,
  save,
  remove,
  searchCatalog,
  selectCatalog,
  syncProgress,
  setDialogElement,
} = toRefs(props.model);
const backdrop = createBackdropDismiss(() => {
  close.value();
});
const estimateTime = computed({
  get: () => form.value.time_mode === 'estimated',
  set: (value: boolean) => {
    form.value.time_mode = value ? 'estimated' : 'manual';
  },
});
function optionalNumber(field: 'year' | 'runtime_minutes' | 'total_episodes', event: Event) {
  if (event.target instanceof HTMLInputElement)
    form.value[field] = event.target.value === '' ? null : event.target.valueAsNumber;
}
function setDate(field: 'started_at' | 'completed_at', event: Event) {
  if (event.target instanceof HTMLInputElement) form.value[field] = event.target.value || null;
}
</script>
<template>
  <div
    v-if="dialog"
    class="modal-backdrop"
    @pointerdown="backdrop.down"
    @pointerup="backdrop.up"
    @pointercancel="backdrop.cancel"
  >
    <section
      :ref="setDialogElement"
      class="modal media-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-dialog-title"
    >
      <div class="modal-header">
        <div>
          <span class="eyebrow">ТВОЯ КИНОКОЛЛЕКЦИЯ</span>
          <h2 id="media-dialog-title">
            {{ form.id ? 'Карточка просмотра' : 'Добавить фильм или сериал' }}
          </h2>
        </div>
        <button
          type="button"
          class="icon-button"
          aria-label="Закрыть карточку"
          :disabled="busy"
          @click="close"
        >
          <X :size="20" />
        </button>
      </div>
      <p v-if="error" class="alert error" role="alert">{{ error }}</p>
      <form class="modal-form" @submit.prevent="save">
        <label
          >Тип<select
            v-model="form.kind"
            :disabled="Boolean(form.id) || catalogBusy"
            @change="
              catalogResults = [];
              catalogSearched = false;
            "
          >
            <option value="movie">Фильм</option>
            <option value="series">Сериал</option>
          </select></label
        >
        <section v-if="!form.id" class="media-catalog-search">
          <label class="field-label">Найти в каталоге</label>
          <div class="steam-search">
            <SearchField
              v-model="catalogQuery"
              label="Поиск фильмов и сериалов"
              placeholder="Название фильма или сериала…"
              @search="searchCatalog"
            />
            <button
              type="button"
              class="button secondary"
              :disabled="catalogBusy || catalogQuery.trim().length < 2"
              @click="searchCatalog"
            >
              <LoaderCircle v-if="catalogBusy" class="spin" :size="16" />{{
                catalogBusy ? 'Ищу…' : 'Найти'
              }}
            </button>
          </div>
          <p class="field-hint">
            Обложки, IMDb и серии загружаются без ключа. Карточку можно заполнить вручную.
          </p>
          <div v-if="catalogSearched" class="media-search-results">
            <p v-if="!catalogResults.length" class="muted">
              Ничего не найдено. Попробуй оригинальное название.
            </p>
            <button
              v-for="result in catalogResults"
              :key="result.imdb_id"
              type="button"
              class="media-search-result"
              :disabled="catalogBusy"
              @click="selectCatalog(result)"
            >
              <img
                v-if="result.poster"
                :src="result.poster"
                alt=""
                loading="lazy"
                decoding="async"
                width="36"
                height="52"
              /><Film v-else :size="25" /><span
                >{{ result.name }}<small v-if="result.original_name">{{ result.original_name }}</small
                ><small>{{ result.year ?? 'Год не указан' }}</small></span
              ><Plus :size="17" />
            </button>
          </div>
        </section>
        <div v-if="form.source === 'cinemeta'" class="media-source-preview">
          <img v-if="form.poster" :src="form.poster" alt="Обложка" />
          <div>
            <strong>{{ form.name }}</strong>
            <p v-if="form.imdb_rating !== null">
              IMDb {{ form.imdb_rating.toLocaleString('ru-RU') }} / 10
            </p>
            <p v-if="form.kind === 'series'">{{ form.episodes.length }} серий в каталоге</p>
            <a
              v-if="form.imdb_id"
              :href="`https://www.imdb.com/title/${form.imdb_id}/`"
              target="_blank"
              rel="noreferrer"
              >Карточка IMDb <ExternalLink :size="13" /></a
            ><button
              v-if="form.id && form.imdb_id"
              type="button"
              class="text-button"
              :disabled="catalogBusy"
              @click="
                selectCatalog(
                  {
                    imdb_id: form.imdb_id,
                    name: form.name,
                    kind: form.kind,
                    poster: form.poster,
                    year: form.year,
                  },
                  true,
                )
              "
            >
              <RefreshCw :size="14" />Обновить данные каталога
            </button>
          </div>
        </div>
        <label
          >Название<input
            v-model="form.name"
            required
            maxlength="160"
            placeholder="Название фильма или сериала"
        /></label>
        <div class="form-grid">
          <label
            >Статус<select v-model="form.status">
              <option v-for="(label, id) in mediaStatuses" :key="id" :value="id">{{ label }}</option>
            </select></label
          ><label
            >Год выхода<input
              :value="form.year ?? ''"
              type="number"
              min="1800"
              max="3000"
              step="1"
              placeholder="Не указан"
              @input="optionalNumber('year', $event)"
          /></label>
        </div>
        <RatingInput v-model="form.rating" />
        <div class="form-grid">
          <label
            >Начал смотреть<input
              type="date"
              :value="form.started_at ?? ''"
              @input="setDate('started_at', $event)"
          /></label>
          <label
            >Закончил смотреть<input
              type="date"
              :value="form.completed_at ?? ''"
              :min="form.started_at || undefined"
              @input="setDate('completed_at', $event)"
          /></label>
        </div>
        <label
          >Обложка - ссылка HTTPS<input v-model="form.poster" type="url" placeholder="https://…"
        /></label>
        <label
          >{{
            form.kind === 'movie' ? 'Длительность фильма, минуты' : 'Средняя длительность серии, минуты'
          }}<input
            :value="form.runtime_minutes ?? ''"
            type="number"
            min="1"
            max="10000"
            step="1"
            placeholder="Не указана"
            @input="optionalNumber('runtime_minutes', $event)"
        /></label>
        <fieldset v-if="form.kind === 'series'" class="duration-fields">
          <legend>На чём остановился</legend>
          <div class="form-grid">
            <label
              >Сезон<select
                v-if="seasons.length"
                v-model="form.current_season"
                @change="
                  form.current_episode = 0;
                  syncProgress();
                "
              >
                <option v-for="season in seasons" :key="season" :value="season">
                  Сезон {{ season }}
                </option></select
              ><input
                v-else
                v-model.number="form.current_season"
                type="number"
                min="1"
                max="1000"
                required
                step="1" /></label
            ><label
              >Последняя просмотренная серия<select
                v-if="seasonEpisodes.length"
                v-model="form.current_episode"
                @change="syncProgress"
              >
                <option :value="0">Ещё не смотрел этот сезон</option>
                <option
                  v-for="episode in seasonEpisodes"
                  :key="episode.number"
                  :value="episode.number"
                  :title="episode.name"
                >
                  Серия {{ episode.number }}
                </option></select
              ><input
                v-else
                v-model.number="form.current_episode"
                type="number"
                min="0"
                max="100000"
                required
                step="1"
            /></label>
          </div>
          <div class="form-grid">
            <label
              >Всего серий<input
                :value="form.total_episodes ?? ''"
                :readonly="Boolean(form.episodes.length)"
                type="number"
                min="0"
                max="100000"
                step="1"
                placeholder="Неизвестно"
                @input="optionalNumber('total_episodes', $event)" /></label
            ><label
              >Просмотрено серий<input
                v-model.number="form.watched_episodes"
                :readonly="Boolean(form.episodes.length)"
                type="number"
                min="0"
                max="100000"
                required
                step="1"
            /></label>
          </div>
        </fieldset>
        <fieldset class="duration-fields">
          <legend>Время просмотра</legend>
          <CheckboxField v-model="estimateTime" label="Рассчитывать по длительности фильма или серий" />
          <p v-if="form.time_mode === 'estimated'" class="field-hint">
            Это приблизительное время. Для точного учёта отключи расчёт и укажи своё.
          </p>
          <div v-else class="form-grid">
            <label>Часы<input v-model="hours" type="number" min="0" step="1" placeholder="0" /></label
            ><label
              >Минуты<input v-model="minutes" type="number" min="0" max="59" step="1" placeholder="0"
            /></label>
          </div>
          <p class="field-hint">
            Время хранится только в библиотеке и не добавляется в таймлайн или статистику дня.
          </p>
          <p v-if="form.id" class="field-hint">
            Сейчас в карточке: {{ duration(form.watched_minutes * 60000) }}.
          </p>
        </fieldset>
        <label
          >Твои впечатления<textarea
            v-model="form.review"
            rows="3"
            maxlength="10000"
            placeholder="Что понравилось или почему забросил?"
          />
        </label>
        <details v-if="form.description">
          <summary>Описание из каталога</summary>
          <p class="muted media-description">{{ form.description }}</p>
        </details>
        <div v-if="confirmingDelete" class="alert error">
          <span>Удалить эту карточку? Восстановить её можно будет из резервной копии.</span
          ><button type="button" class="button danger-button" :disabled="busy" @click="remove">
            Удалить карточку</button
          ><button type="button" class="text-button" @click="confirmingDelete = false">Оставить</button>
        </div>
        <div class="modal-actions">
          <button
            v-if="form.id && !confirmingDelete"
            type="button"
            class="button danger-button"
            :disabled="busy"
            @click="confirmingDelete = true"
          >
            <Trash2 :size="16" />Удалить</button
          ><button type="button" class="button secondary" :disabled="busy" @click="close">Отмена</button
          ><button class="button primary" :disabled="busy || catalogBusy">
            <LoaderCircle v-if="busy" :size="16" class="spin" />Сохранить
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
