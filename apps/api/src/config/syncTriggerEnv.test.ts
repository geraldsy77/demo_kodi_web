import { describe, expect, it } from 'vitest';

import { parseOptionalSyncTriggerEnvironment } from './syncTriggerEnv.js';

const validEnvironment = {
  KODI_ADDON_TRIGGER_ENABLED: 'true',
  KODI_ADDON_TRIGGER_TOKEN: 'a'.repeat(32),
  KODI_SYNC_TOKEN: 'b'.repeat(32),
  KODI_SYNC_RUNNER_PATH: '/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh',
  KODI_SYNC_LOCK_DIR: '/volume1/web/kodi-web/run/kodi-sync.lock',
  KODI_MANUAL_SYNC_STATUS_FILE:
    '/volume1/web/kodi-web/run/kodi-manual-sync-status.json',
  KODI_SYNC_STATUS_FILE: '/volume1/web/kodi-web/run/kodi-sync-status.json',
};

describe('parseOptionalSyncTriggerEnvironment', () => {
  it('keeps the native trigger disabled by default', () => {
    expect(parseOptionalSyncTriggerEnvironment({})).toBeNull();
  });

  it('parses a complete enabled configuration without returning the sync token', () => {
    expect(parseOptionalSyncTriggerEnvironment(validEnvironment)).toEqual({
      KODI_ADDON_TRIGGER_TOKEN: 'a'.repeat(32),
      KODI_SYNC_RUNNER_PATH: validEnvironment.KODI_SYNC_RUNNER_PATH,
      KODI_SYNC_LOCK_DIR: validEnvironment.KODI_SYNC_LOCK_DIR,
      KODI_MANUAL_SYNC_STATUS_FILE:
        validEnvironment.KODI_MANUAL_SYNC_STATUS_FILE,
      KODI_SYNC_STATUS_FILE: validEnvironment.KODI_SYNC_STATUS_FILE,
    });
  });

  it('requires a dedicated trigger token of at least 32 characters', () => {
    expect(() =>
      parseOptionalSyncTriggerEnvironment({
        ...validEnvironment,
        KODI_ADDON_TRIGGER_TOKEN: 'short-token',
      }),
    ).toThrow();

    expect(() =>
      parseOptionalSyncTriggerEnvironment({
        ...validEnvironment,
        KODI_ADDON_TRIGGER_TOKEN: validEnvironment.KODI_SYNC_TOKEN,
      }),
    ).toThrow('must not reuse the sync token');
  });

  it.each([
    'KODI_SYNC_RUNNER_PATH',
    'KODI_SYNC_LOCK_DIR',
    'KODI_MANUAL_SYNC_STATUS_FILE',
    'KODI_SYNC_STATUS_FILE',
  ] as const)('requires an absolute path for %s', (key) => {
    expect(() =>
      parseOptionalSyncTriggerEnvironment({
        ...validEnvironment,
        [key]: 'relative/path',
      }),
    ).toThrow();
  });
});
