import { z } from 'zod';
import { gameStatusSchema } from '../src/shared/api/contracts.ts';
const time = z.union([z.number(), z.string()]);
export const sessionInputSchema = z.object({
  category_ids: z.string().array().optional(),
  category_id: z.string().optional(),
  game_id: z.string().nullable().optional(),
  title: z.string().optional(),
  note: z.string().optional(),
  start_at: time.optional(),
  end_at: time.nullable().optional(),
});
export const categoryInputSchema = z.object({
  name: z.string().optional(),
  group_name: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  is_work: z.boolean().optional(),
});
export const gameInputSchema = z.object({
  name: z.string().optional(),
  steam_appid: z.number().int().positive().nullable().optional(),
  poster: z.string().optional(),
  status: gameStatusSchema.optional(),
  rating: z.number().nullable().optional(),
  review: z.string().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  playtime_minutes: z.number().int().nonnegative().optional(),
});
export type GameInput = z.infer<typeof gameInputSchema>;
export const settingsInputSchema = z.object({
  steam_path: z.string().optional(),
  api_key: z.string().optional(),
  steam_id: z.string().optional(),
  confirmation: z.string().optional(),
});
export const steamSearchSchema = z.object({
  items: z
    .object({ id: z.number(), name: z.string(), tiny_image: z.string().optional() })
    .array()
    .default([]),
});
export const steamOwnedSchema = z.object({
  response: z.object({
    games: z
      .object({ appid: z.number(), name: z.string(), playtime_forever: z.number().optional() })
      .array(),
  }),
});
