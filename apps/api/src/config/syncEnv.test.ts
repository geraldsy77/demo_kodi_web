import { describe, expect, it } from 'vitest';

import { parseSyncEnvironment } from './syncEnv.js';

describe('parseSyncEnvironment', () => {
  it('requires HTTPS and bounds batches and retries', () => {
    expect(() => parseSyncEnvironment({
      KODI_SYNC_ENDPOINT: 'http://worker.example.test/sync',
      KODI_SYNC_TOKEN: 'a-secure-test-token',
    })).toThrow();
    expect(() => parseSyncEnvironment({
      KODI_SYNC_ENDPOINT: 'https://worker.example.test/sync',
      KODI_SYNC_TOKEN: 'a-secure-test-token',
      KODI_SYNC_BATCH_SIZE: '51',
    })).toThrow();
  });

  it('parses safe defaults without exposing the token', () => {
    const result = parseSyncEnvironment({
      KODI_SYNC_ENDPOINT: 'https://worker.example.test/api/internal/sync/snapshots',
      KODI_SYNC_TOKEN: 'a-secure-test-token',
    });
    expect(result).toMatchObject({
      KODI_SYNC_BATCH_SIZE: 50,
      KODI_SYNC_MAX_RETRIES: 4,
      KODI_SYNC_STATUS_FILE: '.kodi-sync-status.json',
      KODI_SYNC_DRY_RUN: false,
    });
  });
});
