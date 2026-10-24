<script setup lang="ts">
import WebsitesSummary from './WebsitesSummary.vue';
import type { WorkspaceView } from '../../../features/workspace/index.ts';
import type { EditorView } from '../../../features/record-editor/index.ts';

import { computed, toRefs } from 'vue';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  Gamepad2,
  Layers,
  List,
  Play,
  Plus,
  Timer,
} from 'lucide-vue-next';
import { clock, weekday, posterFailed } from '../../../shared/lib/format.ts';
import { duration, localDate } from '../../../shared/lib/date.ts';
import { activityIcons as icons } from '../../../entities/activity/index.ts';
import { statuses } from '../../../entities/game/index.ts';
import PeriodChart from './PeriodChart.vue';
import LibraryHistory from './LibraryHistory.vue';
import AutomaticTracking from './AutomaticTracking.vue';
import ActivityRecords from './ActivityRecords.vue';
import { activityGroups } from '../../../entities/activity/index.ts';
import TimerCards from './TimerCards.vue';
import DayTimeline from './DayTimeline.vue';
const props = defineProps<{ model: WorkspaceView; editor: EditorView }>();
const {
  page,
  date,
  view,
  display,
  categories,
  active,
  selected,
  now,
  busy,
  stats,
  todayStats,
  activeIds,
  trackedDays,
  chartBuckets,
  topCategories,
  playingGames,
  dateLabel,
  daySessions,
  toggle,
  start,
  navigate,
  changeView,
  changeDate,
  changeDisplay,
  step,
  dayOpen,
} = toRefs(props.model);
const { editSession, editGame } = toRefs(props.editor);
const recordCount = computed(() => activityGroups(daySessions.value, now.value).length);
const donutGradient = computed(() => {
  let cursor = 0;
  const total = props.model.stats.categoryTotal;
  return total
    ? 'conic-gradient(' +
        props.model.topCategories
          .map((c) => {
            const start = cursor;
            cursor += (c.duration / total) * 100;
            return `${c.color} ${start}% ${cursor}%`;
          })
          .join(',') +
        ')'
    : 'var(--line)';
});
</script>
<template>
  <div class="stats-grid">
    <article class="stat-card">
      <span class="stat-icon purple"><Clock3 :size="19" /></span
      ><span class="stat-label">Учтено времени</span><strong>{{ duration(stats.total) }}</strong
      ><span class="stat-foot">Общее время без повторного счёта</span>
      <div class="stat-decoration purple-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon blue"><Code2 :size="19" /></span
      ><span class="stat-label">Время за работой</span><strong>{{ duration(stats.work) }}</strong
      ><span class="stat-foot">Кодинг, учёба и твои проекты</span>
      <div class="stat-decoration blue-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon orange"><Gamepad2 :size="19" /></span
      ><span class="stat-label">Игровое время</span
      ><strong>{{
        duration(
          stats.byCategory
            .filter((c) => c.group_name === 'Развлечения' && (c.icon === 'gamepad' || c.name === 'Игры'))
            .reduce((sum, c) => sum + c.duration, 0),
        )
      }}</strong
      ><span class="stat-foot">Место для нового приключения</span>
      <div class="stat-decoration orange-line" />
    </article>
    <article class="stat-card">
      <span class="stat-icon green"><Activity :size="19" /></span
      ><span class="stat-label">{{
        page === 'analytics' ? 'Записей за период' : 'Активных таймеров'
      }}</span
      ><strong
        >{{ page === 'analytics' ? stats.count : String(active.length).padStart(2, '0')
        }}<small>{{
          page === 'analytics' ? ' сессий' : active.length ? ' в процессе' : ' можно начинать'
        }}</small></strong
      ><span class="stat-foot">{{
        page === 'analytics' ? 'Включая параллельные занятия' : 'Занятия можно совмещать'
      }}</span>
      <div class="stat-decoration green-line" />
    </article>
  </div>

  <section v-if="page === 'dashboard'" class="panel tracker-panel">
    <div class="section-heading">
      <div class="section-title">
        <span class="live-indicator"><Timer :size="19" /></span>
        <h2>Чем займёмся?</h2>
        <span class="subtle-label">Выбери одно или несколько занятий</span>
      </div>
      <span class="keyboard-hint">Твой фокус. Твои правила.</span>
    </div>
    <div class="activity-picker">
      <button
        v-for="c in categories"
        :key="c.id"
        :disabled="activeIds.has(c.id)"
        :class="['activity-chip', { selected: selected.includes(c.id), running: activeIds.has(c.id) }]"
        :style="{ '--activity': c.color }"
        :title="`${c.group_name} / ${c.name}`"
        @click="toggle(c.id)"
      >
        <component :is="icons[c.icon] || Layers" :size="16" />{{ c.name
        }}<Check v-if="selected.includes(c.id)" :size="14" /><span
          v-if="activeIds.has(c.id)"
          class="status-dot"
        />
      </button>
    </div>
    <div class="tracker-footer">
      <span
        ><Layers :size="15" />{{
          selected.length ? `Выбрано занятий: ${selected.length}` : 'Кодинг + видео? Почему бы и нет.'
        }}</span
      ><button class="button primary" :disabled="!selected.length || busy" @click="start">
        <Play :size="16" fill="currentColor" />Начать занятие
      </button>
    </div>
    <TimerCards :model="model" @edit="editSession" />
    <AutomaticTracking :now="now" :categories="categories" />
  </section>

  <div class="dashboard-columns" :class="{ 'analytics-columns': page === 'analytics' }">
    <section class="panel timeline-panel">
      <div class="section-heading calendar-heading">
        <div class="section-title">
          <CalendarDays :size="18" class="muted" />
          <h2>{{ page === 'analytics' ? 'Обзор периода' : 'Таймлайн' }}</h2>
        </div>
        <div class="segmented">
          <button
            v-for="[value, label] in [
              ['day', 'День'],
              ['week', 'Неделя'],
              ['month', 'Месяц'],
            ]"
            :key="value"
            :class="{ active: view === value }"
            @click="changeView(value)"
          >
            {{ label }}
          </button>
        </div>
      </div>
      <div class="date-toolbar">
        <div class="date-navigation">
          <button class="icon-button" aria-label="Предыдущий период" @click="step(-1)">
            <ChevronLeft :size="17" /></button
          ><label class="date-label"
            >{{ dateLabel
            }}<input
              aria-label="Дата просмотра"
              type="date"
              :value="date"
              @change="changeDate(($event.target as HTMLInputElement).value)" /></label
          ><button class="icon-button" aria-label="Следующий период" @click="step(1)">
            <ChevronRight :size="17" /></button
          ><button class="today-button" @click="changeDate(localDate())">Сегодня</button>
        </div>
        <span
          v-if="view === 'day' && page === 'dashboard' && date === localDate(now)"
          class="current-time-label"
          >Сейчас {{ clock(now) }}</span
        >
        <div v-if="view === 'day' && page === 'dashboard'" class="view-toggle">
          <button
            :class="['icon-button', { active: display === 'timeline' }]"
            aria-label="Временная шкала"
            @click="changeDisplay('timeline')"
          >
            <CalendarDays :size="16" /></button
          ><button
            :class="['icon-button', { active: display === 'list' }]"
            aria-label="Список записей"
            @click="changeDisplay('list')"
          >
            <List :size="17" />
          </button>
        </div>
      </div>

      <WebsitesSummary
        v-if="page === 'dashboard' && view === 'day'"
        :sessions="daySessions"
        :categories="categories"
        :now="now"
        :date="date"
      />
      <PeriodChart
        v-if="page === 'analytics'"
        :buckets="chartBuckets"
        :categories="topCategories"
        :view="view"
        @open-day="dayOpen"
      />
      <DayTimeline
        v-else-if="view === 'day' && display === 'timeline'"
        :sessions="daySessions"
        :categories="categories"
        :games="model.games"
        :date="date"
        :now="now"
        @edit="editSession"
      />
      <div v-else-if="view === 'day'" class="session-list">
        <div v-if="!daySessions.length" class="empty-state">
          <Clock3 :size="32" />
          <h3>Пока нет записей</h3>
          <p>Добавь первое занятие этого дня.</p>
        </div>
        <ActivityRecords :sessions="daySessions" :model="model" @edit="editSession" />
      </div>
      <div v-else class="calendar-grid" :class="{ monthly: view === 'month' }">
        <button
          v-for="d in trackedDays"
          :key="d.date"
          :class="['calendar-cell', { today: d.date === localDate() }]"
          @click="dayOpen(d.date)"
        >
          <span
            >{{ weekday(d.date) }} <b>{{ new Date(`${d.date}T12:00:00`).getDate() }}</b></span
          ><strong>{{ duration(d.total) }}</strong>
          <div class="mini-categories">
            <i
              v-for="c in d.byCategory.filter((c) => c.duration > 0).slice(0, 4)"
              :key="c.id"
              :style="{ background: c.color }"
              :title="c.name"
            />
          </div>
          <small>{{ d.count ? `${d.count} сессий` : 'Нет записей' }}</small>
        </button>
      </div>
      <details
        v-if="page === 'dashboard' && view === 'day' && display === 'timeline' && daySessions.length"
        class="day-details"
      >
        <summary>Записи и результаты · {{ recordCount }}</summary>
        <ActivityRecords :sessions="daySessions" :model="model" @edit="editSession" />
      </details>
      <div class="panel-footer">
        <span
          ><span class="legend-dot purple-bg" />{{
            view === 'day'
              ? `За день учтено: ${duration(todayStats.total)}`
              : `За период: ${duration(stats.total)}`
          }}</span
        ><span>Общий итог учитывает одновременные занятия один раз</span>
      </div>
    </section>

    <aside class="right-column">
      <section class="panel distribution-panel">
        <div class="section-heading">
          <h2>Баланс времени</h2>
          <BarChart3 :size="17" class="muted" />
        </div>
        <div class="donut-wrap">
          <div class="donut" :style="{ background: donutGradient }">
            <div>
              <small>По занятиям</small><strong>{{ duration(stats.categoryTotal) }}</strong>
            </div>
          </div>
        </div>
        <div class="distribution-list">
          <div v-for="c in topCategories.slice(0, 6)" :key="c.id">
            <span><i class="legend-dot" :style="{ background: c.color }" />{{ c.name }}</span
            ><b>{{ duration(c.duration) }}</b>
          </div>
          <p v-if="!topCategories.length" class="muted">Здесь появится распределение твоих занятий.</p>
        </div>
        <div class="subtle-note">
          Если занятия идут одновременно, время учитывается в каждой категории. В общем итоге оно
          считается один раз.
        </div>
      </section>
      <section v-if="page === 'dashboard'" class="panel playing-panel">
        <div class="section-heading">
          <h2>Сейчас играю</h2>
          <button class="text-button" @click="navigate('games')">
            Все игры <ChevronRight :size="13" />
          </button>
        </div>
        <div v-if="!playingGames.length" class="small-empty">
          <Gamepad2 :size="27" />
          <p>Какой мир исследуем?</p>
          <button class="button secondary" @click="editGame()"><Plus :size="14" />Добавить игру</button>
        </div>
        <button v-for="g in playingGames" :key="g.id" class="playing-game" @click="editGame(g)">
          <div class="mini-poster">
            <Gamepad2 :size="20" /><img
              v-if="g.poster"
              :src="g.poster"
              alt=""
              loading="lazy"
              @error="posterFailed"
            />
          </div>
          <div>
            <strong>{{ g.name }}</strong
            ><small>{{ statuses[g.status] }}</small>
          </div>
          <ChevronRight :size="16" />
        </button>
      </section>
      <div class="tip-card">
        <span class="tip-icon">✦</span>
        <div>
          <strong>{{
            page === 'analytics' ? 'Важен твой ритм' : 'Делай больше. Записывай проще.'
          }}</strong>
          <p>
            {{
              page === 'analytics'
                ? 'Работа и отдых - части одного дня. Здесь нет гонки за продуктивностью.'
                : 'Таймеры продолжат отсчёт, даже если закрыть вкладку или перезапустить приложение.'
            }}
          </p>
        </div>
      </div>
    </aside>
  </div>
  <LibraryHistory v-if="page === 'analytics'" :games="model.games" :media="model.media" />
</template>

<style scoped>
.timeline-panel {
  overflow: clip;
}
</style>
