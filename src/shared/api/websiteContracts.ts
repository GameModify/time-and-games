import { z } from 'zod';
export const websiteAssignmentSchema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(253)
    .refine((host) => {
      const url = URL.parse('https://' + host);
      return Boolean(url && url.hostname === host && url.pathname === '/' && !url.port && !url.username);
    }, 'Укажи домен сайта без пути'),
  category_id: z.string().min(1).max(80),
  project: z.string().trim().max(100).default(''),
});
export type WebsiteAssignment = z.infer<typeof websiteAssignmentSchema>;
