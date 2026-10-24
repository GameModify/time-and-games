import { dashboardCardsSchema, defaultDashboardCards } from './dashboardContracts.ts';
import { z } from 'zod';
import { mediaSchema, personalRatingSchema } from './mediaContracts.ts';

export const gameStatusSchema = z.enum(['backlog', 'playing', 'completed', 'paused', 'dropped']);
export const categorySchema = z.object({
  id: z.string(),
  group_name: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  is_work: z.boolean(),
  sort_order: z.number().int(),
});
export const gameSchema = z.object({
  id: z.string(),
  steam_appid: z.number().int().nullable(),
  name: z.string(),
  poster: z.string(),
  status: gameStatusSchema,
  favorite: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform(Boolean)
    .default(false),
  rating: personalRatingSchema,
  review: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  playtime_minutes: z.number(),
  created_at: z.number(),
  tracked_minutes: z.number().optional(),
  total_minutes: z.number().optional(),
});
export const sessionContextSchema = z.object({
  app: z.string().max(200).optional(),
  media_creator: z.string().max(200).optional(),
  media_id: z.string().max(100).optional(),
  website: z.string().max(253).optional(),
  project: z.string().max(100).optional(),
});
export type SessionContext = z.infer<typeof sessionContextSchema>;
export const sessionSchema = z.object({
  tracking_context: sessionContextSchema.optional(),
  tracking_live: z.boolean().optional(),
  group_id: z.string().optional(),
  id: z.string(),
  category_id: z.string(),
  game_id: z.string().nullable(),
  title: z.string(),
  note: z.string(),
  start_at: z.number(),
  end_at: z.number().nullable(),
  created_at: z.number(),
});
export const timerSchema = sessionSchema.extend({
  elapsed_before: z.number().nonnegative().default(0),
  timer_id: z.string().optional(),
});
export const pausedTimerSchema = timerSchema.required({ timer_id: true });
export const timerGroupSchema = z.object({
  id: z.string().min(1),
  paused: z.boolean(),
  session_ids: z.string().min(1).array().min(1),
});
export { dashboardCardsSchema, defaultDashboardCards } from './dashboardContracts.ts';
export type { DashboardCard, DashboardCards, DashboardMetric } from './dashboardContracts.ts';
export const bootstrapSchema = z.object({
  dashboard_cards: dashboardCardsSchema.default(defaultDashboardCards),
  categories: categorySchema.array(),
  games: gameSchema.array(),
  active: timerSchema.array(),
  paused: pausedTimerSchema.array().default([]),
  media: mediaSchema.array().default([]),
});
export const backupCategorySchema = categorySchema.extend({
  is_work: z.union([z.boolean(), z.literal(0), z.literal(1)]),
});
export const backupSchema = z.object({
  dashboard_cards: dashboardCardsSchema.optional(),
  format: z.literal('time-and-games-backup'),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  exported_at: z.string(),
  categories: backupCategorySchema.array(),
  games: gameSchema.array(),
  sessions: sessionSchema.array(),
  timer_groups: timerGroupSchema.array().optional(),
  media: mediaSchema.array().default([]),
});
export const steamResultSchema = z.object({
  appid: z.number(),
  name: z.string(),
  poster: z.string(),
  thumbnail: z.string(),
});
export const importResultSchema = z.object({
  found: z.number(),
  added: z.number(),
  skipped: z.number(),
});
export type Category = z.infer<typeof categorySchema>;
export type Game = z.infer<typeof gameSchema>;
export type GameStatus = z.infer<typeof gameStatusSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type PausedTimer = z.infer<typeof pausedTimerSchema>;
export type Timer = z.infer<typeof timerSchema>;
export type TimerGroup = z.infer<typeof timerGroupSchema>;
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type SteamResult = z.infer<typeof steamResultSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type DateValue = Date | string | number;
export type NumericInput = string | number;
export type ActivityCategory = Pick<Category, 'id'> & Partial<Omit<Category, 'id'>>;
export type ActivitySession = Pick<Session, 'category_id' | 'start_at' | 'end_at'> &
  Partial<Pick<Session, 'id' | 'group_id'>>;
export type TimelineSession = Pick<Session, 'id' | 'start_at' | 'end_at'> &
  Partial<Omit<Session, 'id' | 'start_at' | 'end_at'>>;
