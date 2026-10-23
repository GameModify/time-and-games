<script setup lang="ts">
import type { Game } from '../../../shared/api/contracts.ts';
import type { EditorView } from '../../../features/record-editor/index.ts';

import { toRefs } from 'vue';
import { Gamepad2, Pencil, Plus, Clock3, Trophy, Library, Play } from 'lucide-vue-next';
import RatingBadge from '../../../shared/ui/RatingBadge.vue';
import SearchField from '../../../shared/ui/SearchField.vue';
import FavoriteButton from '../../../shared/ui/FavoriteButton.vue';
import FavoriteFilter from '../../../shared/ui/FavoriteFilter.vue';
import { shortDate, posterFailed } from '../../../shared/lib/format.ts';
import { statuses, gameMinutes } from '../../../entities/game/index.ts';
import { duration } from '../../../shared/lib/date.ts';
import { useGameLibrary } from '../model/useGameLibrary.ts';
const props = defineProps<{
  games: Game[];
  editor: EditorView;
  toggleFavorite: (game: Game) => Promise<void>;
  busy: boolean;
}>();
const { games } = toRefs(props);
const {
  search,
  favoritesOnly,
  periodLabel,
  statusFilter,
  completionPeriod,
  completedYears,
  filteredGames,
  libraryStats,
  setStatus,
  setPeriod,
} = useGameLibrary(games);
const { importReport, open, editGame } = toRefs(props.editor);
</script>
<template>
  <div class="stats-grid library-stats">
    <article class="stat-card">
      <span class="stat-icon purple"><Library :size="19" /></span
      ><span class="stat-label">Всего в библиотеке</span><strong>{{ libraryStats.total }}</strong
      ><span class="stat-foot">Все твои игры</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon green"><Trophy :size="19" /></span><span class="stat-label">Пройдено</span
      ><strong>{{ libraryStats.completed }}</strong
      ><span class="stat-foot">Завершённые истории</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon blue"><Play :size="19" /></span><span class="stat-label">В процессе</span
      ><strong>{{ libraryStats.playing }}</strong
      ><span class="stat-foot">Сейчас играешь</span>
    </article>
    <article class="stat-card">
      <span class="stat-icon orange"><Clock3 :size="19" /></span
      ><span class="stat-label">Время во всех играх</span
      ><strong>{{ duration(libraryStats.minutes * 60000) }}</strong
      ><span class="stat-foot">Общее время Steam, вручную или по таймеру</span>
    </article>
  </div>
  <section class="library-banner">
    <div>
      <span class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ ИСТОРИЙ</span>
      <h2>За каждым постером —<br />твоё приключение.</h2>
      <p>
        {{ games.length }} в библиотеке <span>·</span>
        {{ games.filter((g) => g.status === 'completed').length }} пройдено <span>·</span>
        {{ games.filter((g) => g.status === 'playing').length }} в процессе
      </p>
      <button
        class="button secondary"
        @click="
          open('steam');
          importReport = '';
        "
      >
        <Gamepad2 :size="17" />Импорт из Steam
      </button>
    </div>
    <div class="banner-art" aria-hidden="true">
      <Gamepad2 :size="150" :stroke-width="1" /><span class="orbit orbit-one" /><span
        class="orbit orbit-two"
      /><span class="art-spark">✦</span>
    </div>
  </section>
  <div class="library-toolbar">
    <div class="filter-tabs">
      <button :class="{ active: statusFilter === 'all' }" @click="setStatus('all')">
        Все <span>{{ games.length }}</span></button
      ><button
        v-for="(label, id) in statuses"
        :key="id"
        :class="{ active: statusFilter === id }"
        @click="setStatus(id)"
      >
        {{ label }} <span>{{ games.filter((g) => g.status === id).length }}</span>
      </button>
    </div>
    <SearchField v-model="search" label="Поиск в коллекции" placeholder="Найти в коллекции…" />
  </div>
  <div class="library-period">
    <FavoriteFilter v-model="favoritesOnly" :count="games.filter((g) => g.favorite).length" />
    <label
      >{{ periodLabel
      }}<select :value="completionPeriod" @change="setPeriod(($event.target as HTMLInputElement).value)">
        <option value="all">За всё время</option>
        <option value="month">В этом месяце</option>
        <option value="last-month">В прошлом месяце</option>
        <option value="year">В этом году</option>
        <option value="last-year">В прошлом году</option>
        <option value="earlier">До этого года</option>
        <option v-for="year in completedYears" :key="year" :value="`year:${year}`">
          За {{ year }} год
        </option>
        <option value="undated">Без даты</option>
      </select></label
    >
    <p>
      Показано: <b>{{ libraryStats.shown }}</b> · Пройдено: <b>{{ libraryStats.shownCompleted }}</b> ·
      Время: <b>{{ duration(libraryStats.shownMinutes * 60000) }}</b>
    </p>
  </div>
  <div v-if="!filteredGames.length" class="panel empty-state library-empty">
    <Gamepad2 :size="45" />
    <h3>{{ games.length ? 'Ничего не нашлось' : 'Твоя коллекция начинается здесь' }}</h3>
    <p>
      {{
        games.length
          ? 'Попробуй другое название или статус.'
          : 'Добавь любимую игру или импортируй библиотеку Steam.'
      }}
    </p>
    <button v-if="!games.length" class="button primary" @click="editGame()">
      <Plus :size="16" />Добавить первую игру
    </button>
  </div>
  <div class="games-grid">
    <article v-for="g in filteredGames" :key="g.id" class="game-card">
      <button class="game-open" @click="editGame(g)">
        <div class="game-poster">
          <div class="poster-fallback">
            <Gamepad2 :size="45" /><span>{{ g.name }}</span>
          </div>
          <img v-if="g.poster" :src="g.poster" :alt="g.name" loading="lazy" @error="posterFailed" /><span
            :class="['game-status', g.status]"
            >{{ statuses[g.status] }}</span
          ><RatingBadge v-if="g.rating !== null" class="game-rating" :value="g.rating" /><span
            class="poster-edit"
            ><Pencil :size="16"
          /></span>
        </div>
        <div class="game-info">
          <h3>{{ g.name }}</h3>
          <span class="game-playtime"
            ><Clock3 :size="14" />{{
              gameMinutes(g) ? duration(gameMinutes(g) * 60000) : 'Время не указано'
            }}</span
          >
          <span>{{
            g.completed_at
              ? `Пройдена ${shortDate(g.completed_at)}`
              : g.started_at
                ? `Начата ${shortDate(g.started_at)}`
                : 'Новая история ждёт'
          }}</span>
        </div>
      </button>
      <FavoriteButton
        class="favorite-mark"
        :active="g.favorite"
        :name="g.name"
        :disabled="busy"
        @toggle="toggleFavorite(g)"
      />
    </article>
  </div>
</template>
