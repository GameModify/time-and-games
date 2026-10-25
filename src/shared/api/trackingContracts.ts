import { z } from 'zod';
export const trackingMappingSchema = z.object({
  activity: z.string().trim().min(1).max(80),
  category_id: z.string().min(1),
});
export const trackingConnectionSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().max(100),
  token: z
    .string()
    .regex(/^$|^[a-f0-9]{64}$/)
    .optional(),
  auto_import: z.boolean(),
  mappings: trackingMappingSchema.array().max(100),
});
export const trackingSettingsSchema = trackingConnectionSchema
  .omit({ token: true })
  .extend({ token_set: z.boolean() });
export const trackerPlaybackSchema = z.object({
  channel: z.string(),
  title: z.string(),
  playing: z.boolean(),
  observed_at: z.number(),
  position_seconds: z.number().nonnegative().optional(),
  duration_seconds: z.number().nonnegative().optional(),
});
export const foregroundSchema = z.object({
  website: z.string().optional(),
  recording: z.boolean().optional(),
  fullscreen: z.boolean().optional(),
  game_candidate: z.boolean().optional(),
  monitor: z.enum(['primary', 'secondary']).optional(),
  app: z.string(),
  title: z.string(),
  timestamp: z.number(),
  kind: z.enum(['focus', 'media', 'voice']),
  active: z.boolean(),
  idle_ms: z.number(),
  idle_timeout_ms: z.number().positive().optional(),
  interaction_at: z.number().optional(),
  resource_kind: z.enum(['app', 'document', 'game', 'voice']).optional(),
  resource_id: z.string().optional(),
});
export const trackingPreferencesSchema = z.object({
  idle_timeout_ms: z.number().int().min(60000).max(1800000).multipleOf(60000),
});
export type TrackingPreferences = z.infer<typeof trackingPreferencesSchema>;
export const trackerStatusSchema = z.object({
  idle_timeout_ms: trackingPreferencesSchema.shape.idle_timeout_ms.optional(),
  foreground_rule: z
    .object({ name: z.string(), activity: z.string(), project: z.string().optional() })
    .nullable()
    .optional(),
  assistant: foregroundSchema.nullable().optional(),
  browser: foregroundSchema.nullable().optional(),
  game: foregroundSchema.nullable().optional(),
  foreground: foregroundSchema.nullable().optional(),
  voice: z
    .object({ state: z.enum(['connected', 'disconnected', 'unknown']), observed_at: z.number() })
    .optional(),
  api_version: z.literal(1),
  playback: trackerPlaybackSchema.array().max(100).default([]),
  device_id: z.uuid(),
  paused: z.boolean(),
  desktop_available: z.boolean(),
  desktop_error: z.boolean(),
  desktop_at: z.number().nullable(),
  browser_at: z.number().nullable(),
  browser_version: z.string().nullable().optional(),
});
export const trackerIntervalSchema = z.object({
  media_creator: z.string().max(200).optional(),
  media_id: z.string().max(100).optional(),
  website: z.string().max(253).optional(),
  project: z.string().max(100).optional(),
  app: z.string().optional(),
  resource_id: z.string().optional(),
  resource_kind: z.enum(['app', 'document', 'game', 'voice']).optional(),
  id: z.uuid(),
  sequence: z.number().int().positive(),
  channel: z.string(),
  source: z.enum(['windows', 'chrome']),
  activity: z.string().nullable(),
  title: z.string(),
  start_at: z.number().int(),
  end_at: z.number().int(),
  rule_id: z.uuid().nullable(),
  closed: z.boolean(),
});
export const trackerPageSchema = z.object({
  api_version: z.literal(1),
  device_id: z.uuid(),
  cursor: z.number().int().nonnegative(),
  has_more: z.boolean(),
  intervals: trackerIntervalSchema.array().max(500),
});
export const trackingStateSchema = z.object({
  settings: trackingSettingsSchema,
  connected: z.boolean(),
  status: trackerStatusSchema.nullable(),
  error: z.string(),
  pending: z.number().int(),
});
export const trackingInboxSchema = trackerIntervalSchema.extend({
  device_id: z.uuid(),
  state: z.enum(['pending', 'imported', 'ignored']),
});
export const trackingImportSchema = z.object({
  id: z.uuid(),
  device_id: z.uuid(),
  category_id: z.string().min(1),
  remember: z.boolean().optional(),
});
export const trackingIgnoreSchema = trackingImportSchema.omit({ category_id: true, remember: true });
export const trackerRuleSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    field: z.enum(['app', 'title', 'url', 'host', 'kind', 'resource_id', 'media_creator', 'media_id']),
    operator: z.enum(['equals', 'contains', 'within']),
    value: z.string().trim().min(1).max(200),
    activity: z.string().trim().min(1).max(80),
    scope: z.enum(['focus', 'media', 'voice']).optional(),
    project: z.string().trim().min(1).max(100).optional(),
    priority: z.number().int().min(0).max(1000),
  })
  .refine(
    (rule) =>
      rule.operator !== 'within' ||
      (rule.field === 'resource_id' &&
        /^(?:[a-z]:[\\\\/]|[\\\\/]{2}[^\\\\/]+[\\\\/][^\\\\/]+)/i.test(rule.value)),
    'Для правила папки нужен полный путь Windows',
  );
export const trackingRulesWriteSchema = z.object({ rules: trackerRuleSchema.array().max(200) });
export type TrackingConnection = z.infer<typeof trackingConnectionSchema>;
export type TrackingSettings = z.infer<typeof trackingSettingsSchema>;
export type TrackerStatus = z.infer<typeof trackerStatusSchema>;
export type TrackerInterval = z.infer<typeof trackerIntervalSchema>;
export type TrackerPage = z.infer<typeof trackerPageSchema>;
export type TrackingState = z.infer<typeof trackingStateSchema>;
export type TrackingInboxItem = z.infer<typeof trackingInboxSchema>;
export type TrackingImport = z.infer<typeof trackingImportSchema>;
export type TrackingIgnore = z.infer<typeof trackingIgnoreSchema>;
export type TrackerRule = z.infer<typeof trackerRuleSchema>;
export type TrackingRulesWrite = z.infer<typeof trackingRulesWriteSchema>;

export const gameApplicationSchema = z.object({
  app: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^\\/:*?"<>|]+\.exe$/i),
  title: z.string().trim().min(1).max(100),
});
export type GameApplication = z.infer<typeof gameApplicationSchema>;

export const contentLabelSchema = z.object({
  aliases: z.string().min(1).max(80).array().max(100).default([]),
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(100),
  activity: z.string().min(1).max(80),
  color: z.string().regex(/^#[a-f0-9]{6}$/i),
});
export type ContentLabel = z.infer<typeof contentLabelSchema>;
export const classificationSchema = z.object({
  session_id: z.string().min(1).max(160),
  category_id: z.string().min(1).max(80),
  scope: z.enum(['record', 'video', 'channel', 'app', 'site']),
  project: z.string().trim().max(100).default(''),
});
export type Classification = z.infer<typeof classificationSchema>;
