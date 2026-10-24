import { z } from 'zod';
export const dashboardMetricSchema = z.enum(['total', 'work', 'games', 'timers']);
export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
const sourceCardSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('metric'), metric: dashboardMetricSchema }),
  z.object({ kind: z.literal('category'), category_id: z.string().min(1).max(100) }),
]);
export type DashboardCard = z.infer<typeof sourceCardSchema>;
function canonicalCard(card: DashboardCard): DashboardCard {
  return card.kind === 'category' && card.category_id === 'fun-games'
    ? { kind: 'metric', metric: 'games' }
    : card;
}
export function dashboardCardKey(card: DashboardCard): string {
  const value = canonicalCard(card);
  return value.kind === 'metric' ? 'metric:' + value.metric : 'category:' + value.category_id;
}
export const dashboardCardSchema = sourceCardSchema.transform(canonicalCard);
const layoutSchema = z.object({
  cards: dashboardCardSchema
    .array()
    .max(64)
    .refine(
      (cards) => new Set(cards.map(dashboardCardKey)).size === cards.length,
      'Карточки не должны повторяться',
    ),
});
export type DashboardCards = z.infer<typeof layoutSchema>;
export function defaultDashboardCards(): DashboardCards {
  return {
    cards: ['total', 'work', 'games', 'timers'].map((metric) => ({
      kind: 'metric',
      metric: dashboardMetricSchema.parse(metric),
    })),
  };
}
function legacyCards(ids: string[]): DashboardCards {
  const cards = [
    ...defaultDashboardCards().cards,
    ...ids.map((category_id) => canonicalCard({ kind: 'category', category_id })),
  ];
  const seen = new Set<string>();
  return {
    cards: cards.filter((card) => {
      const key = dashboardCardKey(card);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  };
}
const legacySchema = z
  .object({
    category_ids: z
      .string()
      .min(1)
      .max(100)
      .array()
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .transform((legacy) => legacyCards(legacy.category_ids));
export const dashboardCardsSchema = z.union([layoutSchema, legacySchema]);
