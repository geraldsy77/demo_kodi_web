import './config/loadEnvironment.js';

import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { parseOptionalSyncTriggerEnvironment } from './config/syncTriggerEnv.js';
import { createDatabasePool } from './db/pool.js';
import { createManualSyncRunStore } from './services/manualSyncRunStore.js';
import { createManualSyncTriggerService } from './services/manualSyncTriggerService.js';
import { createSyncRunnerLock } from './services/syncRunnerLock.js';
import { createFileSyncRunStatusStore } from './services/syncRunStatus.js';

const config = parseEnvironment(process.env);
const syncTriggerConfig = parseOptionalSyncTriggerEnvironment(process.env);
const pool = createDatabasePool(config);

const manualSync = syncTriggerConfig
  ? {
      triggerToken: syncTriggerConfig.KODI_ADDON_TRIGGER_TOKEN,
      service: createManualSyncTriggerService({
        runnerPath: syncTriggerConfig.KODI_SYNC_RUNNER_PATH,
        runnerLock: createSyncRunnerLock(
          syncTriggerConfig.KODI_SYNC_LOCK_DIR,
        ),
        manualStatusStore: createManualSyncRunStore(
          syncTriggerConfig.KODI_MANUAL_SYNC_STATUS_FILE,
        ),
        syncStatusStore: createFileSyncRunStatusStore(
          syncTriggerConfig.KODI_SYNC_STATUS_FILE,
        ),
      }),
    }
  : undefined;

const app = createApp(pool, {
  webDistPath: config.WEB_DIST_PATH,
  ...(manualSync ? { manualSync } : {}),
});

const server = app.listen(config.API_PORT, config.API_HOST, () => {
  console.log(
    `KODI Web listening on ${config.API_HOST}:${config.API_PORT}`,
  );
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log(`KODI Web received ${signal}; shutting down.`);

  server.close((serverError) => {
    void pool
      .end()
      .catch(() => {
        process.exitCode = 1;
      })
      .finally(() => {
        if (serverError) {
          process.exitCode = 1;
        }
      });
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);