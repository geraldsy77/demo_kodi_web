import '../config/loadEnvironment.js';

import { parseEnvironment } from '../config/env.js';
import { parseSyncEnvironment } from '../config/syncEnv.js';
import { createDatabasePool } from '../db/pool.js';
import { createFileSnapshotStateStore } from '../services/snapshotState.js';
import { synchronizeKodiSnapshot } from '../services/snapshotSyncService.js';
import { createSnapshotUploader } from '../services/snapshotUploader.js';
import { createFileSyncRunStatusStore, observeSyncRun } from '../services/syncRunStatus.js';

async function main(): Promise<void> {
  const databaseConfig = parseEnvironment(process.env);
  if (!databaseConfig.KODI_VIDEO_DB) throw new Error('KODI_VIDEO_DB is required for synchronization.');
  const syncConfig = parseSyncEnvironment(process.env);
  const pool = createDatabasePool(databaseConfig);
  try {
    const synchronize = () => synchronizeKodiSnapshot({
      pool,
      uploader: createSnapshotUploader({
        endpoint: syncConfig.KODI_SYNC_ENDPOINT,
        token: syncConfig.KODI_SYNC_TOKEN,
        maxRetries: syncConfig.KODI_SYNC_MAX_RETRIES,
      }),
      stateStore: createFileSnapshotStateStore(syncConfig.KODI_SYNC_STATE_FILE),
      batchSize: syncConfig.KODI_SYNC_BATCH_SIZE,
      dryRun: syncConfig.KODI_SYNC_DRY_RUN,
    });
    const result = syncConfig.KODI_SYNC_DRY_RUN
      ? await synchronize()
      : await observeSyncRun(synchronize, createFileSyncRunStatusStore(syncConfig.KODI_SYNC_STATUS_FILE));
    console.log(JSON.stringify({
      message: result.dryRun ? 'KODI snapshot dry run completed.' : 'KODI snapshot synchronized.',
      movieCount: result.movieCount,
      tvShowCount: result.tvShowCount,
    }));
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error('KODI snapshot synchronization failed. Check database access, sync configuration, and network availability.');
  process.exitCode = 1;
});
