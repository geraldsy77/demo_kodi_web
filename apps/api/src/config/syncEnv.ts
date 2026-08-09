import { z } from 'zod';

const booleanValue = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

const syncEnvironmentSchema = z.object({
  KODI_SYNC_ENDPOINT: z.string().url().refine(
    (value) => new URL(value).protocol === 'https:',
    'KODI_SYNC_ENDPOINT must use HTTPS',
  ),
  KODI_SYNC_TOKEN: z.string().min(16, 'KODI_SYNC_TOKEN must contain at least 16 characters'),
  KODI_SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(50),
  KODI_SYNC_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(4),
  KODI_SYNC_STATE_FILE: z.string().trim().min(1).default('.kodi-sync-state.json'),
  KODI_SYNC_DRY_RUN: booleanValue,
});

export type SyncConfig = z.infer<typeof syncEnvironmentSchema>;

export function parseSyncEnvironment(environment: NodeJS.ProcessEnv): SyncConfig {
  return syncEnvironmentSchema.parse(environment);
}
