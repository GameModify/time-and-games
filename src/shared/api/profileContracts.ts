import { z } from 'zod';
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(60),
  avatar: z
    .string()
    .max(200000)
    .regex(/^$|^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/),
});
export type LocalProfile = z.infer<typeof profileSchema>;
export function defaultProfile(): LocalProfile {
  return { name: 'Твоё пространство', avatar: '' };
}
