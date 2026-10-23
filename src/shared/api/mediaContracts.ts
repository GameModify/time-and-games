import { z } from 'zod';
export const personalRatingSchema = z.number().min(0.5).max(10).multipleOf(0.5).nullable();
export const mediaStatusSchema = z.enum(['planned', 'watching', 'completed', 'paused', 'dropped']);
export const mediaKindSchema = z.enum(['movie', 'series']);
export const episodeSchema = z.object({
  season: z.number().int().min(1),
  number: z.number().int().min(1),
  name: z.string().max(300),
  runtime_minutes: z.number().int().positive().nullable(),
  released: z.iso.datetime({ offset: true }).nullable(),
});
export const mediaSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  kind: mediaKindSchema,
  status: mediaStatusSchema,
  favorite: z.boolean().default(false),
  started_at: z.iso.date().nullable().default(null),
  completed_at: z.iso.date().nullable().default(null),
  poster: z.string().max(1000),
  description: z.string().max(10000),
  review: z.string().max(10000),
  rating: personalRatingSchema,
  year: z.number().int().min(1800).max(3000).nullable(),
  imdb_id: z
    .string()
    .regex(/^tt\d{5,12}$/)
    .nullable(),
  imdb_rating: z.number().min(0).max(10).nullable(),
  runtime_minutes: z.number().int().min(1).max(10000).nullable(),
  total_episodes: z.number().int().min(0).max(100000).nullable(),
  episodes: episodeSchema.array().max(100000),
  current_season: z.number().int().min(1).max(1000),
  current_episode: z.number().int().min(0).max(100000),
  watched_episodes: z.number().int().min(0).max(100000),
  watched_minutes: z.number().int().min(0).max(100000000),
  time_mode: z.enum(['estimated', 'manual']),
  source: z.enum(['manual', 'cinemeta']),
  metadata_updated_at: z.number().nullable(),
  created_at: z.number(),
});
export const mediaInputSchema = mediaSchema
  .omit({ id: true, created_at: true, favorite: true, started_at: true, completed_at: true })
  .partial()
  .extend({
    favorite: z.boolean().optional(),
    started_at: z.iso.date().nullable().optional(),
    completed_at: z.iso.date().nullable().optional(),
  });
export const catalogResultSchema = z.object({
  imdb_id: z.string().regex(/^tt\d{5,12}$/),
  name: z.string(),
  original_name: z.string().optional(),
  kind: mediaKindSchema,
  poster: z.string(),
  year: z.number().nullable(),
});
export const catalogDetailsSchema = mediaSchema.omit({
  id: true,
  created_at: true,
  status: true,
  favorite: true,
  started_at: true,
  completed_at: true,
  rating: true,
  review: true,
  current_season: true,
  current_episode: true,
  watched_episodes: true,
  watched_minutes: true,
  time_mode: true,
});
export type Media = z.infer<typeof mediaSchema>;
export type MediaInput = z.infer<typeof mediaInputSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type MediaKind = z.infer<typeof mediaKindSchema>;
export type MediaStatus = z.infer<typeof mediaStatusSchema>;
export type CatalogResult = z.infer<typeof catalogResultSchema>;
export type CatalogDetails = z.infer<typeof catalogDetailsSchema>;
