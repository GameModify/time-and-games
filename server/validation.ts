import { z } from 'zod';
export {
  sessionInputSchema,
  categoryInputSchema,
  gameInputSchema,
  settingsInputSchema,
} from '../src/shared/api/inputContracts.ts';
export type { GameInput } from '../src/shared/api/inputContracts.ts';
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
