<script setup lang="ts">
import { reactive, toRef, toRefs } from 'vue';
import { Check, Clock3, Film, Plus, Tv, Play, Pencil } from 'lucide-vue-next';
import RatingBadge from '../../../shared/ui/RatingBadge.vue';
import SearchField from '../../../shared/ui/SearchField.vue';
import FavoriteButton from '../../../shared/ui/FavoriteButton.vue';
import FavoriteFilter from '../../../shared/ui/FavoriteFilter.vue';
import type { Media } from '../../../shared/api/mediaContracts.ts';
import { mediaStatuses } from '../../../entities/media/index.ts';
import { posterFailed } from '../../../shared/lib/format.ts';
import { duration } from '../../../shared/lib/date.ts';
import { useMediaLibrary } from '../model/useMediaLibrary.ts';
import MediaDialog from './MediaDialog.vue';
const props = defineProps<{
  items: Media[];
  load: () => Promise<void>;
  flash: (message: string) => void;
}>();
const model = reactive(useMediaLibrary(toRef(props, 'items'), props.load, props.flash));
const {
  search,
  favoritesOnly,
  toggleFavorite,
  status,
  kind,
  error,
  dialog,
  busy,
  filtered,
  stats,
  open,
  advance,
} = toRefs(model);
</script>
<template>
  <div class="stats-grid">
    <article class="stat-card">
      <span class="stat-icon purple"><Film :size="19" /></span
      ><span class="stat-label">В библиотеке</span><strong>{{ stats.total }}</strong
      ><span class="stat-foot">Фильмы и сериалы</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon green"><Check :size="19" /></span><span class="stat-label">Просмотрено</span
      ><strong>{{ stats.completed }}</strong
      ><span class="stat-foot">Завершённые истории</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon blue"><Play :size="19" /></span><span class="stat-label">Сейчас смотрю</span
      ><strong>{{ stats.watching }}</strong
      ><span class="stat-foot">Можно продолжить с нужной серии</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon orange"><Clock3 :size="19" /></span
      ><span class="stat-label">Время просмотра</span
      ><strong>{{ duration(stats.minutes * 60000) }}</strong
      ><span class="stat-foot">Отдельно от таймлайна, по хронометражу или вручную</span>
    </article>
  </div>
  <section class="panel media-intro">
    <div>
      <span class="eyebrow">ТВОЯ КИНОКОЛЛЕКЦИЯ</span>
      <h2>Истории, к которым хочется вернуться</h2>
      <p class="muted">Сохраняй фильмы, отмечай серии и записывай впечатления.</p>
    </div>
    <button class="button primary" @click="open()"><Plus :size="17" />Добавить фильм или сериал</button>
  </section>
  <div class="library-toolbar">
    <div class="filter-tabs">
      <button :class="{ active: status === 'all' }" @click="status = 'all'">
        Все <span>{{ items.length }}</span></button
      ><button
        v-for="(label, id) in mediaStatuses"
        :key="id"
        :class="{ active: status === id }"
        @click="status = id"
      >
        {{ label }} <span>{{ items.filter((m) => m.status === id).length }}</span>
      </button>
    </div>
    <SearchField
      v-model="search"
      label="Поиск в библиотеке фильмов и сериалов"
      placeholder="Найти в библиотеке…"
    />
  </div>
  <div class="media-kind-filter" role="group" aria-label="Тип просмотра">
    <FavoriteFilter v-model="favoritesOnly" :count="items.filter((item) => item.favorite).length" />
    <button :class="['button', 'small', kind === 'all' ? 'primary' : 'secondary']" @click="kind = 'all'">
      Все типы</button
    ><button
      :class="['button', 'small', kind === 'movie' ? 'primary' : 'secondary']"
      @click="kind = 'movie'"
    >
      <Film :size="15" />Фильмы</button
    ><button
      :class="['button', 'small', kind === 'series' ? 'primary' : 'secondary']"
      @click="kind = 'series'"
    >
      <Tv :size="15" />Сериалы</button
    ><span class="muted">Показано: {{ filtered.length }}</span>
  </div>
  <p v-if="error && !dialog" class="alert error" role="alert">{{ error }}</p>
  <div v-if="!filtered.length" class="panel empty-library">
    <Film :size="40" />
    <h3>{{ items.length ? 'Ничего не найдено' : 'Что посмотрим?' }}</h3>
    <p>
      {{
        items.length
          ? 'Попробуй другой фильтр или название.'
          : 'Найди фильм или сериал по названию, обложку и данные загрузим из каталога.'
      }}
    </p>
    <button v-if="!items.length" class="button primary" @click="open()">
      <Plus :size="16" />Добавить в библиотеку
    </button>
  </div>
  <div v-else class="media-grid">
    <article v-for="item in filtered" :key="item.id" class="panel media-card">
      <FavoriteButton
        class="favorite-mark"
        :active="item.favorite"
        :name="item.name"
        :disabled="busy"
        @toggle="toggleFavorite(item)"
      />
      <button class="media-cover" :aria-label="`Открыть ${item.name}`" @click="open(item)">
        <img
          v-if="item.poster"
          :src="item.poster"
          :alt="item.name"
          loading="lazy"
          @error="posterFailed"
        /><Film class="media-placeholder" :size="65" :stroke-width="1" /><span class="media-type-chip">{{
          item.kind === 'movie' ? 'Фильм' : 'Сериал'
        }}</span
        ><RatingBadge v-if="item.rating !== null" class="media-rating-chip" :value="item.rating" /><span
          class="poster-edit"
          ><Pencil :size="16"
        /></span>
      </button>
      <div class="media-card-info">
        <button class="media-title" @click="open(item)">{{ item.name }}</button>
        <div class="media-card-meta">
          <span>{{ item.year ?? 'Год не указан' }}</span
          ><span :class="['media-status', item.status]">{{ mediaStatuses[item.status] }}</span>
        </div>
        <p v-if="item.imdb_rating !== null" class="media-external-rating">
          <a
            v-if="item.imdb_id"
            :href="`https://www.imdb.com/title/${item.imdb_id}/`"
            target="_blank"
            rel="noreferrer"
            >IMDb {{ item.imdb_rating.toLocaleString('ru-RU') }}</a
          ><span v-else>IMDb {{ item.imdb_rating.toLocaleString('ru-RU') }}</span
          ><small>через Cinemeta</small>
        </p>
        <template v-if="item.kind === 'series'"
          ><p class="media-position">
            {{
              item.current_episode
                ? `Сезон ${item.current_season}, серия ${item.current_episode}`
                : 'Просмотр ещё не начат'
            }}
          </p>
          <div class="media-progress-track" aria-hidden="true">
            <span
              :style="{
                width: `${item.total_episodes ? Math.min(100, (item.watched_episodes / item.total_episodes) * 100) : 0}%`,
              }"
            />
          </div>
          <p class="field-hint">
            {{ item.watched_episodes }}
            {{ item.total_episodes !== null ? `из ${item.total_episodes}` : 'просмотрено' }} серий
          </p></template
        >
        <p class="media-watchtime">
          <Clock3 :size="15" />{{ item.time_mode === 'estimated' && item.watched_minutes ? '≈ ' : ''
          }}{{ item.watched_minutes ? duration(item.watched_minutes * 60000) : 'Время не указано' }}
        </p>
        <p v-if="item.review" class="media-review">{{ item.review }}</p>
        <button
          v-if="
            item.kind === 'series' &&
            !(item.total_episodes !== null && item.watched_episodes >= item.total_episodes)
          "
          class="button secondary small"
          :disabled="busy"
          :aria-label="`Отметить следующую серию ${item.name}`"
          @click="advance(item)"
        >
          <Check :size="15" /><span>Следующая серия просмотрена</span>
        </button>
        <button v-else class="button secondary small" @click="open(item)">
          <Pencil :size="15" /><span>Изменить карточку</span>
        </button>
      </div>
    </article>
  </div>
  <p class="media-attribution">
    Обложки, IMDb и сведения о сериях:
    <a href="https://cinemeta.strem.io/stremio/v1" target="_blank" rel="noreferrer">Cinemeta</a>. Твоя
    оценка хранится отдельно от рейтинга IMDb.
  </p>
  <MediaDialog :model="model" />
</template>
