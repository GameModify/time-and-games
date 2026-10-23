import { z } from 'zod';

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
  rating: z.number().nullable(),
  review: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  playtime_minutes: z.number(),
  created_at: z.number(),
  tracked_minutes: z.number().optional(),
  total_minutes: z.number().optional(),
});
export const sessionSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  game_id: z.string().nullable(),
  title: z.string(),
  note: z.string(),
  start_at: z.number(),
  end_at: z.number().nullable(),
  created_at: z.number(),
});
export const bootstrapSchema = z.object({
  categories: categorySchema.array(),
  games: gameSchema.array(),
  active: sessionSchema.array(),
});
export const backupCategorySchema = categorySchema.extend({
  is_work: z.union([z.boolean(), z.literal(0), z.literal(1)]),
});
export const backupSchema = z.object({
  format: z.literal('time-and-games-backup'),
  version: z.literal(1),
  exported_at: z.string(),
  categories: backupCategorySchema.array(),
  games: gameSchema.array(),
  sessions: sessionSchema.array(),
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
export type Bootstrap = z.infer<typeof bootstrapSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type SteamResult = z.infer<typeof steamResultSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type DateValue = Date | string | number;
export type NumericInput = string | number;
export type ActivityCategory = Pick<Category, 'id'> & Partial<Omit<Category, 'id'>>;
export type ActivitySession = Pick<Session, 'category_id' | 'start_at' | 'end_at'>;
export type TimelineSession = Pick<Session, 'id' | 'start_at' | 'end_at'> &
  Partial<Omit<Session, 'id' | 'start_at' | 'end_at'>>;
