import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().trim().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_DIST_PATH: z.string().trim().optional().transform((value) => value || undefined),
  KODI_DB_HOST: z.string().trim().min(1, 'KODI_DB_HOST is required'),
  KODI_DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
  KODI_DB_USER: z.string().trim().min(1, 'KODI_DB_USER is required'),
  KODI_DB_PASSWORD: z.string().min(1, 'KODI_DB_PASSWORD is required'),
  KODI_VIDEO_DB: z.string().trim().optional().transform((value) => value || undefined),
});

export type ApiConfig = z.infer<typeof environmentSchema>;

export function parseEnvironment(environment: NodeJS.ProcessEnv): ApiConfig {
  return environmentSchema.parse(environment);
}
