import type {
  Category,
  DashboardCard,
  DashboardCards,
  DashboardMetric,
} from '../../../shared/api/contracts.ts';
import { dashboardCardKey } from '../../../shared/api/dashboardContracts.ts';
import { duration } from '../../../shared/lib/date.ts';
export interface MetricSummary {
  total: number;
  work: number;
  count: number;
  byCategory: (Category & { duration: number })[];
}
export interface MetricContext {
  summary: MetricSummary;
  active: number;
  analytics: boolean;
  period: string;
}
export interface MetricView {
  id: string;
  label: string;
  value: string;
  detail?: string;
  caption: string;
  icon: string;
  tone: 'purple' | 'blue' | 'orange' | 'green' | 'custom';
  color?: string;
}
export interface MetricChoice {
  card: DashboardCard;
  label: string;
}
export const metricChoices: MetricChoice[] = [
  { card: { kind: 'metric', metric: 'total' }, label: 'Учтено времени' },
  { card: { kind: 'metric', metric: 'work' }, label: 'Время за работой: все рабочие категории' },
  { card: { kind: 'metric', metric: 'games' }, label: 'Игровое время' },
  { card: { kind: 'metric', metric: 'timers' }, label: 'Активные таймеры / записи за период' },
];
export function categoryMetricChoices(categories: Category[]): MetricChoice[] {
  return categories
    .filter((category) => category.id !== 'fun-games')
    .map((category) => ({
      card: { kind: 'category', category_id: category.id },
      label: category.name,
    }));
}
function totalMetric(context: MetricContext): MetricView {
  return {
    id: 'metric:total',
    label: 'Учтено времени',
    value: duration(context.summary.total),
    caption: 'Общее время без повторного счёта',
    icon: 'clock',
    tone: 'purple',
  };
}
function workMetric(context: MetricContext): MetricView {
  return {
    id: 'metric:work',
    label: 'Время за работой',
    value: duration(context.summary.work),
    caption: 'Все рабочие категории',
    icon: 'code',
    tone: 'blue',
  };
}
function gamesMetric(context: MetricContext): MetricView {
  const elapsed = context.summary.byCategory
    .filter(
      (category) =>
        category.group_name === 'Развлечения' &&
        (category.icon === 'gamepad' || category.name === 'Игры'),
    )
    .reduce((sum, category) => sum + category.duration, 0);
  return {
    id: 'metric:games',
    label: 'Игровое время',
    value: duration(elapsed),
    caption: 'Суммарное игровое время',
    icon: 'gamepad',
    tone: 'orange',
  };
}
function timersMetric(context: MetricContext): MetricView {
  return {
    id: 'metric:timers',
    label: context.analytics ? 'Записей за период' : 'Активных таймеров',
    value: context.analytics ? String(context.summary.count) : String(context.active).padStart(2, '0'),
    detail: context.analytics ? 'сессий' : context.active ? 'в процессе' : 'можно начинать',
    caption: context.analytics ? 'Включая параллельные занятия' : 'Занятия можно совмещать',
    icon: 'activity',
    tone: 'green',
  };
}
const metricBuilders: Record<DashboardMetric, (context: MetricContext) => MetricView> = {
  total: totalMetric,
  work: workMetric,
  games: gamesMetric,
  timers: timersMetric,
};
function categoryMetric(id: string, context: MetricContext): MetricView | undefined {
  const category = context.summary.byCategory.find((item) => item.id === id);
  if (!category) return undefined;
  return {
    id: 'category:' + id,
    label: category.name,
    value: duration(category.duration),
    caption: context.period,
    icon: category.icon,
    tone: 'custom',
    color: category.color,
  };
}
export function dashboardMetrics(cards: DashboardCards, context: MetricContext): MetricView[] {
  return cards.cards.flatMap((card) => {
    const metric =
      card.kind === 'metric'
        ? metricBuilders[card.metric](context)
        : categoryMetric(card.category_id, context);
    return metric ? [metric] : [];
  });
}
export function isMetricSelected(cards: DashboardCard[], card: DashboardCard): boolean {
  return cards.some((item) => dashboardCardKey(item) === dashboardCardKey(card));
}
