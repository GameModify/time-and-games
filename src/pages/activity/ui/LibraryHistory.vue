<script setup lang="ts">
import { computed, ref } from 'vue';
import { Gamepad2, Film, Tv, CalendarDays } from 'lucide-vue-next';
import type { Game } from '../../../shared/api/contracts.ts';
import type { Media } from '../../../shared/api/mediaContracts.ts';
import { localDate, duration } from '../../../shared/lib/date.ts';
import { posterFailed, shortDate } from '../../../shared/lib/format.ts';
import { librarySummary, completionMonths } from '../lib/libraryHistory.ts';
const props = defineProps<{ games: Game[]; media: Media[] }>();
const labels = { game: 'Игры', movie: 'Фильмы', series: 'Сериалы' };
const icons = { game: Gamepad2, movie: Film, series: Tv };
const year = ref(localDate().slice(0, 4));
const selectedMonth = ref('all');
const summary = computed(() => librarySummary(props.games, props.media));
const years = computed(() =>
  [
    ...new Set([
      localDate().slice(0, 4),
      ...summary.value.rows.flatMap((row) => (row.date ? [row.date.slice(0, 4)] : [])),
    ]),
  ]
    .sort()
    .reverse(),
);
const months = computed(() => completionMonths(summary.value.rows, year.value));
const max = computed(() => Math.max(1, ...months.value.map((month) => month.items.length)));
const groups = computed(() =>
  months.value.filter(
    (month) =>
      month.items.length && (selectedMonth.value === 'all' || selectedMonth.value === month.key),
  ),
);
const undated = computed(() => summary.value.rows.filter((row) => !row.date));
function monthLabel(key: string) {
  return new Date(`${key}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long' });
}
</script>
<template>
  <section class="library-statistics" aria-labelledby="library-stats-title">
    <div class="section-heading">
      <div>
        <h2 id="library-stats-title">Игры, фильмы и сериалы</h2>
        <p class="muted">Библиотеки за всё время. Время не прибавляется к итогу таймлайна.</p>
      </div>
    </div>
    <div class="collection-totals">
      <article v-for="total in summary.totals" :key="total.kind" class="panel collection-total">
        <component :is="icons[total.kind]" :size="21" />
        <h3>{{ labels[total.kind] }}</h3>
        <strong>{{ total.completed }}</strong
        ><span>{{ total.kind === 'game' ? 'пройдено' : 'просмотрено' }}</span>
        <p>
          На завершённые: <b>{{ duration(total.completedMinutes * 60000) }}</b>
        </p>
        <p class="muted">Всего времени: {{ duration(total.minutes * 60000) }}</p>
      </article>
    </div>
    <section class="panel completion-history">
      <div class="section-heading">
        <div class="section-title">
          <CalendarDays :size="19" />
          <h2>История завершений</h2>
        </div>
        <label class="history-year"
          >Год<select v-model="year" @change="selectedMonth = 'all'">
            <option v-for="value in years" :key="value" :value="value">{{ value }}</option>
          </select></label
        >
      </div>
      <div class="completion-chart-scroll">
        <div class="completion-chart" aria-label="Завершения по месяцам">
          <button
            v-for="month in months"
            :key="month.key"
            :class="['completion-month', { selected: selectedMonth === month.key }]"
            :aria-pressed="selectedMonth === month.key"
            :aria-label="`${monthLabel(month.key)} ${year}: ${month.items.length} завершений`"
            @click="selectedMonth = selectedMonth === month.key ? 'all' : month.key"
          >
            <span class="completion-count">{{ month.items.length }}</span
            ><span class="completion-stack"
              ><span
                v-for="part in month.counts"
                :key="part.kind"
                :class="part.kind"
                :style="{ height: `${(part.count / max) * 140}px` }" /></span
            ><span>{{ monthLabel(month.key).slice(0, 3) }}</span>
          </button>
        </div>
      </div>
      <div class="completion-legend">
        <span v-for="(label, kind) in labels" :key="kind" :class="kind">{{ label }}</span
        ><button v-if="selectedMonth !== 'all'" class="text-button" @click="selectedMonth = 'all'">
          Все месяцы
        </button>
      </div>
      <p class="history-note muted">
        Количество завершённых игр и просмотров. Нажми на месяц, чтобы увидеть обложки. Время на
        карточках указано за всё прохождение или просмотр.
      </p>
      <p v-if="!groups.length" class="history-empty muted">В этом периоде завершений пока нет.</p>
      <div v-for="group in groups" :key="group.key" class="history-group">
        <h3>
          {{ monthLabel(group.key) }} {{ year }} <small>{{ group.items.length }}</small>
        </h3>
        <div class="history-posters">
          <article v-for="item in group.items" :key="`${item.kind}:${item.id}`" class="history-item">
            <div class="history-cover">
              <component :is="icons[item.kind]" :size="28" /><img
                v-if="item.poster"
                :src="item.poster"
                :alt="item.name"
                loading="lazy"
                decoding="async"
                @error="posterFailed"
              />
            </div>
            <strong>{{ item.name }}</strong
            ><small>{{ labels[item.kind] }} · {{ item.date ? shortDate(item.date) : '' }}</small
            ><span>{{ duration(item.minutes * 60000) }}</span>
          </article>
        </div>
      </div>
      <details v-if="undated.length" class="history-undated">
        <summary>Без даты завершения: {{ undated.length }}</summary>
        <p class="muted">Укажи дату в карточке, чтобы добавить её в историю по месяцам.</p>
        <ul>
          <li v-for="item in undated" :key="`${item.kind}:${item.id}`">
            {{ item.name }} · {{ labels[item.kind] }} · {{ duration(item.minutes * 60000) }}
          </li>
        </ul>
      </details>
    </section>
  </section>
</template>
