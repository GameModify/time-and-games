import type { UnwrapNestedRefs } from 'vue';
import type { Media } from '../../../shared/api/mediaContracts.ts';
import type {
  Bootstrap,
  DashboardCards,
  Category,
  Game,
  Session,
  Timer,
  PausedTimer,
} from '../../../shared/api/contracts.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  readNavigation,
  navigationUrl,
  isPage,
  isCalendarView,
} from '../../../shared/lib/navigationState.ts';
import type { NavigationState, CalendarDisplay } from '../../../shared/lib/navigationState.ts';
import {
  bootstrapSchema,
  sessionSchema,
  dashboardCardsSchema,
  defaultDashboardCards,
} from '../../../shared/api/contracts.ts';
import { api, readApi } from '../../../shared/api/client.ts';
import { dayBounds, localDate, periodDays, shiftDate } from '../../../shared/lib/date.ts';
import {
  summarize,
  timelineLayout,
  activityBuckets,
  timelineRect,
} from '../../../entities/activity/index.ts';
import { overviewRange } from './overviewRange.ts';
import type { RecentTrackHours } from '../../../entities/activity/index.ts';
interface PlacedSession extends Session {
  start: number;
  end: number;
  lane: number;
  lanes: number;
}
class WorkspaceController {
  tick!: ReturnType<typeof setInterval>;
  refreshTimer!: ReturnType<typeof setInterval>;
  noticeTimer!: ReturnType<typeof setTimeout>;
  requestVersion = 0;
  route = useRoute();
  router = useRouter();
  navigation = computed(() => readNavigation(this.route.fullPath));
  saved = this.navigation.value;
  page = computed(() => this.navigation.value.page);
  date = ref(this.saved.date);
  view = ref(this.saved.view);
  display = ref(this.saved.display);
  registerNavigationWatch = () => {
    watch(this.navigation, (state) => {
      if (state.page === 'dashboard' || state.page === 'analytics') {
        if (this.date.value !== state.date) this.timelineHours.value = null;
        this.date.value = state.date;
        this.view.value = state.view;
        this.display.value = state.display;
      }
      void this.load();
    });
  };
  categories = ref<Category[]>([]);
  games = ref<Game[]>([]);
  media = ref<Media[]>([]);
  sessions = ref<Session[]>([]);
  active = ref<Timer[]>([]);
  paused = ref<PausedTimer[]>([]);
  dashboardCards = ref<DashboardCards>(defaultDashboardCards());
  saveDashboardCards = async (cards: DashboardCards): Promise<void> => {
    this.dashboardCards.value = await readApi('/dashboard-cards', dashboardCardsSchema, 'PATCH', cards);
    await this.load();
  };
  selected = ref<string[]>([]);
  timelineHours = ref<RecentTrackHours | null>(null);
  now = ref(Date.now());
  loading = ref(true);
  busy = ref(false);
  error = ref('');
  notice = ref('');
  days = computed(() => periodDays(this.date.value, this.view.value));
  chartBuckets = computed(() =>
    activityBuckets(
      this.sessions.value,
      this.categories.value,
      this.date.value,
      this.view.value,
      this.now.value,
    ),
  );
  range = computed<[number, number]>(() => [
    dayBounds(this.days.value[0] ?? this.date.value)[0],
    dayBounds(this.days.value.at(-1) ?? this.date.value)[1],
  ]);
  overviewRange = computed(() =>
    overviewRange({
      calendar: this.range.value,
      hours: this.timelineHours.value,
      now: this.now.value,
      rolling:
        this.page.value === 'dashboard' &&
        this.view.value === 'day' &&
        this.display.value === 'timeline',
    }),
  );
  overviewStats = computed(() =>
    summarize(this.sessions.value, this.categories.value, ...this.overviewRange.value, this.now.value),
  );
  sessionRange = computed<[number, number]>(() => {
    const [from, to] = this.range.value;
    const [overviewFrom, overviewTo] = this.overviewRange.value;
    return [Math.min(from, overviewFrom), Math.max(to, overviewTo)];
  });
  setTimelineHours = async (hours: RecentTrackHours | null) => {
    if (hours !== null && this.date.value !== localDate(this.now.value))
      await this.changeDate(localDate(this.now.value));
    this.timelineHours.value = hours;
    await this.load();
  };
  stats = computed(() =>
    summarize(this.sessions.value, this.categories.value, ...this.range.value, this.now.value),
  );
  todayStats = computed(() =>
    summarize(this.sessions.value, this.categories.value, ...dayBounds(this.date.value), this.now.value),
  );
  groupNames = computed(() => [...new Set(this.categories.value.map((c) => c.group_name))]);
  activeIds = computed(() => new Set(this.active.value.map((s) => s.category_id)));
  trackedDays = computed(() =>
    this.days.value.map((d) => ({
      date: d,
      ...summarize(this.sessions.value, this.categories.value, ...dayBounds(d), this.now.value),
    })),
  );
  topCategories = computed(() =>
    this.stats.value.byCategory.filter((c) => c.duration > 0).sort((a, b) => b.duration - a.duration),
  );
  playingGames = computed(() => this.games.value.filter((g) => g.status === 'playing').slice(0, 3));
  dateLabel = computed(() =>
    new Date(`${this.date.value}T12:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
  daySessions = computed(() => {
    const [a, b] = dayBounds(this.date.value);
    return this.sessions.value
      .filter((s) => s.start_at < b && (s.end_at ?? this.now.value) > a)
      .sort((x, y) => x.start_at - y.start_at);
  });
  timeline = computed(() =>
    timelineLayout(this.daySessions.value, ...dayBounds(this.date.value), this.now.value),
  );
  timelineStart = computed(() =>
    Math.min(8, ...this.timeline.value.map((s) => new Date(s.start).getHours())),
  );
  timelineHeight = computed(() => (this.timelineEnd.value - this.timelineStart.value) * 72);
  hours = computed(() =>
    Array.from(
      { length: this.timelineEnd.value - this.timelineStart.value + 1 },
      (_, i) => this.timelineStart.value + i,
    ),
  );
  nowPosition = computed(
    () =>
      (new Date(this.now.value).getHours() +
        new Date(this.now.value).getMinutes() / 60 -
        this.timelineStart.value) *
      72,
  );
  category = (id: string) => {
    return this.categoryMap.value[id] || { name: 'Категория', color: '#8e77ff', group_name: '' };
  };
  gameName = (id?: string | null) => {
    return this.games.value.find((g) => g.id === id)?.name || '';
  };
  flash = (message: string) => {
    this.notice.value = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice.value = '';
    }, 5000);
  };
  applySnapshot = (bootstrap: Bootstrap, rows: Session[]) => {
    this.dashboardCards.value = bootstrap.dashboard_cards;
    this.categories.value = bootstrap.categories;
    this.games.value = bootstrap.games;
    this.media.value = bootstrap.media;
    this.active.value = bootstrap.active;
    this.paused.value = bootstrap.paused;
    this.sessions.value = rows;
    this.selected.value = this.selected.value.filter(
      (id) => !this.activeIds.value.has(id) && this.categoryMap.value[id],
    );
    this.error.value = '';
  };
  load = async () => {
    const version = ++this.requestVersion;
    try {
      const [bootstrap, rows] = await Promise.all([
        readApi('/bootstrap', bootstrapSchema),
        readApi(
          `/sessions?from=${this.sessionRange.value[0]}&to=${this.sessionRange.value[1]}`,
          sessionSchema.array(),
        ),
      ]);
      if (version !== this.requestVersion) return;
      this.applySnapshot(bootstrap, rows);
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      if (version === this.requestVersion) this.loading.value = false;
    }
  };
  toggle = (id: string) => {
    this.selected.value = this.selected.value.includes(id)
      ? this.selected.value.filter((x) => x !== id)
      : [...this.selected.value, id];
  };
  toggleGameFavorite = (game: Game) => {
    return this.action(
      () => api(`/games/${game.id}`, 'PATCH', { favorite: !game.favorite }),
      game.favorite ? 'Убрано из избранного' : 'Добавлено в избранное',
    );
  };
  start = () => {
    return this.action(
      () => api('/sessions', 'POST', { category_ids: this.selected.value }),
      'Таймеры запущены',
    );
  };
  stop = (s: Session) => {
    return this.action(
      () => api(`/sessions/${s.id}`, 'PATCH', { end_at: Math.max(Date.now(), s.start_at + 1) }),
      'Время сохранено. Добавь заметку в записи.',
    );
  };
  pauseTimer = (session: Session) =>
    this.action(() => api('/sessions/' + session.id + '/pause', 'POST'), 'Занятие на паузе');
  resumeTimer = (timer: PausedTimer) =>
    this.action(() => api('/timers/' + timer.timer_id + '/resume', 'POST'), 'Занятие продолжено');
  finishPaused = (timer: PausedTimer) =>
    this.action(() => api('/timers/' + timer.timer_id + '/finish', 'POST'), 'Занятие завершено');
  stopAll = async () => {
    await this.action(async () => {
      const end = Date.now();
      for (const s of this.active.value)
        await api(`/sessions/${s.id}`, 'PATCH', { end_at: Math.max(end, s.start_at + 1) });
    }, 'Все таймеры остановлены');
  };
  changeNavigation = async (patch: Partial<NavigationState>) => {
    await this.router.push(
      navigationUrl({
        page: this.page.value,
        date: this.date.value,
        view: this.view.value,
        display: this.display.value,
        ...patch,
      }),
    );
  };
  navigate = async (id: string) => {
    if (isPage(id)) await this.changeNavigation({ page: id });
  };
  changeView = async (value: string) => {
    if (isCalendarView(value)) await this.changeNavigation({ view: value });
  };
  changeDate = async (value: string) => {
    await this.changeNavigation({ date: value || localDate() });
  };
  changeDisplay = async (value: CalendarDisplay) => {
    await this.changeNavigation({ display: value });
  };
  step = (amount: number) => {
    if (this.view.value === 'month') {
      const d = new Date(`${this.date.value.slice(0, 7)}-01T12:00:00`);
      d.setMonth(d.getMonth() + amount);
      return this.changeDate(localDate(d));
    }
    return this.changeDate(shiftDate(this.date.value, amount * (this.view.value === 'week' ? 7 : 1)));
  };
  eventStyle = (s: PlacedSession) => {
    const rect = timelineRect(
      s.start,
      s.end,
      dayBounds(this.date.value)[0] + this.timelineStart.value * 3600000,
    );
    return {
      top: `${rect.top}px`,
      height: `${rect.height}px`,
      left: `calc(${(s.lane / s.lanes) * 100}% + 3px)`,
      width: `calc(${100 / s.lanes}% - 8px)`,
      '--activity': this.category(s.category_id).color,
    };
  };
  dayOpen = async (d: string) => {
    await this.changeNavigation({ page: 'dashboard', date: d, view: 'day' });
  };
  categoryMap = computed(() => Object.fromEntries(this.categories.value.map((c) => [c.id, c])));
  timelineEnd = computed(() =>
    Math.max(
      21,
      ...this.timeline.value.map((s) => {
        const d = new Date(s.end);
        return localDate(d) !== this.date.value ? 24 : Math.ceil(d.getHours() + d.getMinutes() / 60);
      }),
    ),
  );
  action = async (fn: () => Promise<void>, message: string) => {
    if (this.busy.value) return;
    this.busy.value = true;
    try {
      await fn();
      await this.load();
      if (message) this.flash(message);
    } catch (e) {
      this.error.value = errorMessage(e);
    } finally {
      this.busy.value = false;
    }
  };
  registerMounted = () => {
    onMounted(() => {
      void this.load();
      this.tick = setInterval(() => {
        this.now.value = Date.now();
      }, 1000);
      this.refreshTimer = setInterval(() => {
        void this.load();
      }, 5000);
    });
  };
  registerUnmounted = () => {
    onUnmounted(() => {
      clearInterval(this.tick);
      clearInterval(this.refreshTimer);
      clearTimeout(this.noticeTimer);
    });
  };
  constructor() {
    this.registerNavigationWatch();
    this.registerMounted();
    this.registerUnmounted();
  }
}
type WorkspaceControllerView = Pick<
  WorkspaceController,
  | 'page'
  | 'date'
  | 'view'
  | 'display'
  | 'categories'
  | 'games'
  | 'media'
  | 'sessions'
  | 'dashboardCards'
  | 'saveDashboardCards'
  | 'timelineHours'
  | 'setTimelineHours'
  | 'active'
  | 'paused'
  | 'pauseTimer'
  | 'resumeTimer'
  | 'finishPaused'
  | 'selected'
  | 'now'
  | 'loading'
  | 'busy'
  | 'error'
  | 'notice'
  | 'days'
  | 'range'
  | 'stats'
  | 'overviewStats'
  | 'todayStats'
  | 'groupNames'
  | 'activeIds'
  | 'trackedDays'
  | 'chartBuckets'
  | 'topCategories'
  | 'playingGames'
  | 'dateLabel'
  | 'daySessions'
  | 'timeline'
  | 'timelineStart'
  | 'timelineHeight'
  | 'hours'
  | 'nowPosition'
  | 'category'
  | 'gameName'
  | 'flash'
  | 'load'
  | 'toggle'
  | 'toggleGameFavorite'
  | 'start'
  | 'stop'
  | 'stopAll'
  | 'navigate'
  | 'changeView'
  | 'changeDate'
  | 'changeDisplay'
  | 'step'
  | 'eventStyle'
  | 'dayOpen'
>;
export function useWorkspace(): WorkspaceControllerView {
  return new WorkspaceController();
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;
export type WorkspaceView = UnwrapNestedRefs<WorkspaceModel>;
