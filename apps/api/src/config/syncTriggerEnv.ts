import { z } from 'zod';

const enabledSchema = z.enum(['true', 'false']).default('false');

const syncTriggerSchema = z
  .object({
    KODI_ADDON_TRIGGER_TOKEN: z.string().trim().min(32),
    KODI_SYNC_TOKEN: z.string().optional(),
    KODI_SYNC_RUNNER_PATH: z.string().trim().startsWith('/'),
    KODI_SYNC_LOCK_DIR: z.string().trim().startsWith('/'),
    KODI_MANUAL_SYNC_STATUS_FILE: z.string().trim().startsWith('/'),
    KODI_SYNC_STATUS_FILE: z.string().trim().startsWith('/'),
  })
  .superRefine((value, context) => {
    if (
      value.KODI_SYNC_TOKEN &&
      value.KODI_ADDON_TRIGGER_TOKEN === value.KODI_SYNC_TOKEN
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['KODI_ADDON_TRIGGER_TOKEN'],
        message: 'The add-on trigger token must not reuse the sync token.',
      });
    }
  })
  .transform((value) => ({
    KODI_ADDON_TRIGGER_TOKEN: value.KODI_ADDON_TRIGGER_TOKEN,
    KODI_SYNC_RUNNER_PATH: value.KODI_SYNC_RUNNER_PATH,
    KODI_SYNC_LOCK_DIR: value.KODI_SYNC_LOCK_DIR,
    KODI_MANUAL_SYNC_STATUS_FILE: value.KODI_MANUAL_SYNC_STATUS_FILE,
    KODI_SYNC_STATUS_FILE: value.KODI_SYNC_STATUS_FILE,
  }));

export type SyncTriggerConfig = z.infer<typeof syncTriggerSchema>;

export function parseOptionalSyncTriggerEnvironment(
  environment: NodeJS.ProcessEnv,
): SyncTriggerConfig | null {
  const enabled = enabledSchema.parse(
    environment.KODI_ADDON_TRIGGER_ENABLED,
  );

  if (enabled !== 'true') return null;

  return syncTriggerSchema.parse(environment);
}
