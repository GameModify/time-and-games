import type { UnwrapNestedRefs } from 'vue';
import type { Category, Game, Session } from '../../../shared/api/contracts.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { readNavigation, navigationHash } from '../../../shared/lib/navigationState.ts';
import { bootstrapSchema, sessionSchema } from '../../../shared/api/contracts.ts';
import { api, readApi } from '../../../shared/api/client.ts';
import { dayBounds, localDate, periodDays, shiftDate } from '../../../shared/lib/date.ts';
import {
  summarize,
  timelineLayout,
  activityBuckets,
  timelineRect,
} from '../../../entities/activity/index.ts';
export function useWorkspace() {
  let tick: ReturnType<typeof setInterval>,
    refreshTimer: ReturnType<typeof setInterval>,
    noticeTimer: ReturnType<typeof setTimeout>,
    requestVersion = 0;
  const saved = readNavigation(window.location.hash);
  const page = ref(saved.page);

  const date = ref(saved.date);

  const view = ref(saved.view);

  const display = ref(saved.display);
  watch(
    [page, date, view, display],
    () => {
      window.history.replaceState(
        null,
        '',
        navigationHash({ page: page.value, date: date.value, view: view.value, display: display.value }),
      );
    },
    { flush: 'sync' },
  );

  const categories = ref<Category[]>([]);

  const games = ref<Game[]>([]);

  const sessions = ref<Session[]>([]);

  const active = ref<Session[]>([]);

  const selected = ref<string[]>([]);

  const now = ref(Date.now());

  const loading = ref(true);

  const busy = ref(false);

  const error = ref('');

  const notice = ref('');

  const days = computed(() => periodDays(date.value, view.value));
  const chartBuckets = computed(() =>
    activityBuckets(sessions.value, categories.value, date.value, view.value, now.value),
  );

  const range = computed<[number, number]>(() => [
    dayBounds(days.value[0] ?? date.value)[0],
    dayBounds(days.value.at(-1) ?? date.value)[1],
  ]);

  const stats = computed(() => summarize(sessions.value, categories.value, ...range.value, now.value));

  const todayStats = computed(() =>
    summarize(sessions.value, categories.value, ...dayBounds(date.value), now.value),
  );

  const groupNames = computed(() => [...new Set(categories.value.map((c) => c.group_name))]);

  const activeIds = computed(() => new Set(active.value.map((s) => s.category_id)));

  const trackedDays = computed(() =>
    days.value.map((d) => ({
      date: d,
      ...summarize(sessions.value, categories.value, ...dayBounds(d), now.value),
    })),
  );

  const topCategories = computed(() =>
    stats.value.byCategory.filter((c) => c.duration > 0).sort((a, b) => b.duration - a.duration),
  );

  const playingGames = computed(() => games.value.filter((g) => g.status === 'playing').slice(0, 3));

  const dateLabel = computed(() =>
    new Date(`${date.value}T12:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );

  const daySessions = computed(() => {
    const [a, b] = dayBounds(date.value);
    return sessions.value
      .filter((s) => s.start_at < b && (s.end_at ?? now.value) > a)
      .sort((x, y) => x.start_at - y.start_at);
  });

  const timeline = computed(() =>
    timelineLayout(daySessions.value, ...dayBounds(date.value), now.value),
  );

  const timelineStart = computed(() =>
    Math.min(8, ...timeline.value.map((s) => new Date(s.start).getHours())),
  );

  const timelineHeight = computed(() => (timelineEnd.value - timelineStart.value) * 72);

  const hours = computed(() =>
    Array.from(
      { length: timelineEnd.value - timelineStart.value + 1 },
      (_, i) => timelineStart.value + i,
    ),
  );

  const nowPosition = computed(
    () =>
      (new Date(now.value).getHours() + new Date(now.value).getMinutes() / 60 - timelineStart.value) *
      72,
  );

  function category(id: string) {
    return categoryMap.value[id] || { name: 'Категория', color: '#8e77ff', group_name: '' };
  }

  function gameName(id?: string | null) {
    return games.value.find((g) => g.id === id)?.name || '';
  }

  function flash(message: string) {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.value = '';
    }, 5000);
  }

  async function load() {
    const version = ++requestVersion;
    try {
      const [bootstrap, rows] = await Promise.all([
        readApi('/bootstrap', bootstrapSchema),
        readApi(`/sessions?from=${range.value[0]}&to=${range.value[1]}`, sessionSchema.array()),
      ]);
      if (version !== requestVersion) return;
      categories.value = bootstrap.categories;
      games.value = bootstrap.games;
      active.value = bootstrap.active;
      sessions.value = rows;
      selected.value = selected.value.filter((id) => !activeIds.value.has(id) && categoryMap.value[id]);
      error.value = '';
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  function toggle(id: string) {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((x) => x !== id)
      : [...selected.value, id];
  }

  function start() {
    return action(() => api('/sessions', 'POST', { category_ids: selected.value }), 'Таймеры запущены');
  }

  function stop(s: Session) {
    return action(
      () => api(`/sessions/${s.id}`, 'PATCH', { end_at: Math.max(Date.now(), s.start_at + 1) }),
      'Время сохранено. Добавь заметку в записи.',
    );
  }

  async function stopAll() {
    await action(async () => {
      const end = Date.now();
      for (const s of active.value)
        await api(`/sessions/${s.id}`, 'PATCH', { end_at: Math.max(end, s.start_at + 1) });
    }, 'Все таймеры остановлены');
  }

  async function navigate(id: string) {
    page.value = id;
    await load();
  }

  async function changeView(value: string) {
    view.value = value;
    await load();
  }

  async function changeDate(value: string) {
    date.value = value || localDate();
    await load();
  }

  function step(amount: number) {
    if (view.value === 'month') {
      const d = new Date(`${date.value.slice(0, 7)}-01T12:00:00`);
      d.setMonth(d.getMonth() + amount);
      return changeDate(localDate(d));
    }
    return changeDate(shiftDate(date.value, amount * (view.value === 'week' ? 7 : 1)));
  }

  function eventStyle(s: Session & { start: number; end: number; lane: number; lanes: number }) {
    const rect = timelineRect(s.start, s.end, dayBounds(date.value)[0] + timelineStart.value * 3600000);
    return {
      top: `${rect.top}px`,
      height: `${rect.height}px`,
      left: `calc(${(s.lane / s.lanes) * 100}% + 3px)`,
      width: `calc(${100 / s.lanes}% - 8px)`,
      '--activity': category(s.category_id).color,
    };
  }

  function dayOpen(d: string) {
    date.value = d;
    view.value = 'day';
    page.value = 'dashboard';
    void load();
  }

  const categoryMap = computed(() => Object.fromEntries(categories.value.map((c) => [c.id, c])));

  const timelineEnd = computed(() =>
    Math.max(
      21,
      ...timeline.value.map((s) => {
        const d = new Date(s.end);
        return localDate(d) !== date.value ? 24 : Math.ceil(d.getHours() + d.getMinutes() / 60);
      }),
    ),
  );

  async function action(fn: () => Promise<unknown>, message: string) {
    if (busy.value) return;
    busy.value = true;
    try {
      await fn();
      await load();
      if (message) flash(message);
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      busy.value = false;
    }
  }
  onMounted(() => {
    void load();
    tick = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    refreshTimer = setInterval(() => {
      void load();
    }, 30000);
  });
  onUnmounted(() => {
    clearInterval(tick);
    clearInterval(refreshTimer);
    clearTimeout(noticeTimer);
  });
  return {
    page,
    date,
    view,
    display,
    categories,
    games,
    sessions,
    active,
    selected,
    now,
    loading,
    busy,
    error,
    notice,
    days,
    range,
    stats,
    todayStats,
    groupNames,
    activeIds,
    trackedDays,
    chartBuckets,
    topCategories,
    playingGames,
    dateLabel,
    daySessions,
    timeline,
    timelineStart,
    timelineHeight,
    hours,
    nowPosition,
    category,
    gameName,
    flash,
    load,
    toggle,
    start,
    stop,
    stopAll,
    navigate,
    changeView,
    changeDate,
    step,
    eventStyle,
    dayOpen,
  };
}

export type WorkspaceModel = ReturnType<typeof useWorkspace>;
export type WorkspaceView = UnwrapNestedRefs<WorkspaceModel>;
