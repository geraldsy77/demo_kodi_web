import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import type {
  ManualSyncRun,
  ManualSyncRunStore,
} from './manualSyncRunStore.js';
import type {
  SyncRunnerLock,
  SyncRunnerLockReservation,
} from './syncRunnerLock.js';
import { SyncRunnerLockBusyError } from './syncRunnerLock.js';
import type { SyncRunStatusStore } from './syncRunStatus.js';

export class SyncAlreadyRunningError extends Error {
  constructor() {
    super('A synchronization is already running.');
    this.name = 'SyncAlreadyRunningError';
  }
}

export class SyncRunNotFoundError extends Error {
  constructor() {
    super('Synchronization run not found.');
    this.name = 'SyncRunNotFoundError';
  }
}

interface ManualSyncTriggerDependencies {
  runnerPath: string;
  runnerLock: SyncRunnerLock;
  manualStatusStore: ManualSyncRunStore;
  syncStatusStore: SyncRunStatusStore;
  now?: () => Date;
}

export interface ManualSyncTriggerService {
  start(): Promise<ManualSyncRun>;
  get(runId: string): Promise<ManualSyncRun>;
}

export function createManualSyncTriggerService(
  dependencies: ManualSyncTriggerDependencies,
): ManualSyncTriggerService {
  const now = dependencies.now ?? (() => new Date());

  let activeRunId: string | null = null;
  let activeProcess: ChildProcess | null = null;

  async function finish(
    runId: string,
    startedAt: string,
    exitCode: number | null,
    reservation: SyncRunnerLockReservation,
    failureCode?: ManualSyncRun['failureCode'],
  ): Promise<void> {
    if (activeRunId !== runId) {
      await reservation.release();
      return;
    }

    try {
      const completedAt = now().toISOString();

      const syncStatus = await dependencies.syncStatusStore
        .load()
        .catch(() => null);

      const statusIsForThisRun =
        syncStatus !== null &&
        Date.parse(syncStatus.lastAttemptAt) >= Date.parse(startedAt);

      const successful =
        exitCode === 0 &&
        statusIsForThisRun &&
        syncStatus.outcome === 'success';

      await dependencies.manualStatusStore.save({
        runId,
        status: successful ? 'success' : 'failure',
        startedAt,
        completedAt,
        movieCount: successful ? syncStatus.movieCount : null,
        tvShowCount: successful ? syncStatus.tvShowCount : null,
        failureCode: successful
          ? null
          : failureCode ??
            syncStatus?.failureCode ??
            'SYNC_FAILED',
      });
    } finally {
      activeRunId = null;
      activeProcess = null;
      await reservation.release();
    }
  }

  return {
    async start() {
      if (activeRunId !== null || activeProcess !== null) {
        throw new SyncAlreadyRunningError();
      }

      let reservation: SyncRunnerLockReservation;

      try {
        reservation = await dependencies.runnerLock.reserve();
      } catch (error) {
        if (error instanceof SyncRunnerLockBusyError) {
          throw new SyncAlreadyRunningError();
        }

        throw error;
      }

      const runId = randomUUID();
      const startedAt = now().toISOString();

      const status: ManualSyncRun = {
        runId,
        status: 'running',
        startedAt,
        completedAt: null,
        movieCount: null,
        tvShowCount: null,
        failureCode: null,
      };

      try {
        await dependencies.manualStatusStore.save(status);

        activeRunId = runId;

        const child = spawn(dependencies.runnerPath, [], {
          shell: false,
          stdio: 'ignore',
          windowsHide: true,
        });

        activeProcess = child;

        let finalized = false;

        const finalize = (
          exitCode: number | null,
          failureCode?: ManualSyncRun['failureCode'],
        ): void => {
          if (finalized) return;

          finalized = true;

          void finish(
            runId,
            startedAt,
            exitCode,
            reservation,
            failureCode,
          ).catch(() => {
            console.error(
              'Unable to persist the manual synchronization result.',
            );
          });
        };

        child.once('error', () => {
          finalize(null, 'RUNNER_START_FAILED');
        });

        child.once('close', (exitCode) => {
          finalize(exitCode);
        });

        return status;
      } catch (error) {
        activeRunId = null;
        activeProcess = null;

        await reservation.release();
        throw error;
      }
    },

    async get(runId) {
      const status = await dependencies.manualStatusStore.load();

      if (!status || status.runId !== runId) {
        throw new SyncRunNotFoundError();
      }

      return status;
    },
  };
}