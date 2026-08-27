import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ManualSyncRun,
  ManualSyncRunStore,
} from './manualSyncRunStore.js';
import {
  createManualSyncTriggerService,
  SyncAlreadyRunningError,
  SyncRunNotFoundError,
} from './manualSyncTriggerService.js';
import type {
  SyncRunnerLock,
  SyncRunnerLockReservation,
} from './syncRunnerLock.js';
import { SyncRunnerLockBusyError } from './syncRunnerLock.js';
import type {
  SyncRunStatus,
  SyncRunStatusStore,
} from './syncRunStatus.js';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

function fakeChild(): ChildProcess {
  return new EventEmitter() as ChildProcess;
}

function manualStore(initial: ManualSyncRun | null = null): {
  store: ManualSyncRunStore;
  save: ReturnType<typeof vi.fn>;
  current: () => ManualSyncRun | null;
} {
  let current = initial;
  const save = vi.fn(async (status: ManualSyncRun) => {
    current = status;
  });
  return {
    store: {
      load: vi.fn(async () => current),
      save,
    },
    save,
    current: () => current,
  };
}

function runnerLock(): {
  lock: SyncRunnerLock;
  reserve: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn(async () => undefined);
  const reservation: SyncRunnerLockReservation = { release };
  const reserve = vi.fn(async () => reservation);
  return { lock: { reserve }, reserve, release };
}

function syncStore(status: SyncRunStatus | null): SyncRunStatusStore {
  return {
    load: vi.fn().mockResolvedValue(status),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function successfulSyncStatus(): SyncRunStatus {
  return {
    lastAttemptAt: '2026-08-27T12:01:00.000Z',
    lastSuccessAt: '2026-08-27T12:01:00.000Z',
    lastFailureAt: null,
    outcome: 'success',
    durationMilliseconds: 60_000,
    movieCount: 20,
    tvShowCount: 4,
    failureCode: null,
  };
}

beforeEach(() => {
  spawnMock.mockReset();
});

describe('createManualSyncTriggerService', () => {
  it('reserves the shared lock and invokes only the fixed runner with no arguments', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);
    const runs = manualStore();
    const sharedLock = runnerLock();
    const service = createManualSyncTriggerService({
      runnerPath: '/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh',
      runnerLock: sharedLock.lock,
      manualStatusStore: runs.store,
      syncStatusStore: syncStore(successfulSyncStatus()),
      now: () => new Date('2026-08-27T12:00:00.000Z'),
    });

    const run = await service.start();

    expect(run.status).toBe('running');
    expect(sharedLock.reserve).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith(
      '/volume1/web/kodi-web/scripts/nas/run-kodi-sync.sh',
      [],
      {
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    expect(JSON.stringify(spawnMock.mock.calls)).not.toContain('request');
  });

  it('rejects an API or scheduled run that already owns the shared lock', async () => {
    const lock: SyncRunnerLock = {
      reserve: vi.fn().mockRejectedValue(new SyncRunnerLockBusyError()),
    };
    const service = createManualSyncTriggerService({
      runnerPath: '/fixed-runner.sh',
      runnerLock: lock,
      manualStatusStore: manualStore().store,
      syncStatusStore: syncStore(null),
    });

    await expect(service.start()).rejects.toBeInstanceOf(
      SyncAlreadyRunningError,
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('rejects a duplicate request while its first process is active', async () => {
    spawnMock.mockReturnValue(fakeChild());
    const service = createManualSyncTriggerService({
      runnerPath: '/fixed-runner.sh',
      runnerLock: runnerLock().lock,
      manualStatusStore: manualStore().store,
      syncStatusStore: syncStore(null),
    });

    await service.start();
    await expect(service.start()).rejects.toBeInstanceOf(
      SyncAlreadyRunningError,
    );
  });

  it('records successful completion and row counts', async () => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);
    const runs = manualStore();
    const sharedLock = runnerLock();
    const times = [
      new Date('2026-08-27T12:00:00.000Z'),
      new Date('2026-08-27T12:01:00.000Z'),
    ];
    const service = createManualSyncTriggerService({
      runnerPath: '/fixed-runner.sh',
      runnerLock: sharedLock.lock,
      manualStatusStore: runs.store,
      syncStatusStore: syncStore(successfulSyncStatus()),
      now: () => times.shift()!,
    });

    await service.start();
    child.emit('close', 0);

    await vi.waitFor(() => expect(runs.save).toHaveBeenCalledTimes(2));
    expect(runs.current()).toMatchObject({
      status: 'success',
      completedAt: '2026-08-27T12:01:00.000Z',
      movieCount: 20,
      tvShowCount: 4,
      failureCode: null,
    });
    expect(sharedLock.release).toHaveBeenCalledOnce();
  });

  it.each([
    { event: 'close', value: 1, failureCode: 'SYNC_FAILED' },
    {
      event: 'error',
      value: new Error('private runner path'),
      failureCode: 'RUNNER_START_FAILED',
    },
  ])('records a safe failure after runner $event', async ({
    event,
    value,
    failureCode,
  }) => {
    const child = fakeChild();
    spawnMock.mockReturnValue(child);
    const runs = manualStore();
    const sharedLock = runnerLock();
    const times = [
      new Date('2026-08-27T12:00:00.000Z'),
      new Date('2026-08-27T12:00:05.000Z'),
    ];
    const service = createManualSyncTriggerService({
      runnerPath: '/fixed-runner.sh',
      runnerLock: sharedLock.lock,
      manualStatusStore: runs.store,
      syncStatusStore: syncStore(null),
      now: () => times.shift()!,
    });

    await service.start();
    child.emit(event, value);

    await vi.waitFor(() => expect(runs.save).toHaveBeenCalledTimes(2));
    expect(runs.current()).toMatchObject({
      status: 'failure',
      movieCount: null,
      tvShowCount: null,
      failureCode,
    });
    expect(JSON.stringify(runs.current())).not.toContain('private runner path');
    expect(sharedLock.release).toHaveBeenCalledOnce();
  });

  it('returns persisted status and rejects an unknown run ID', async () => {
    const existing: ManualSyncRun = {
      runId: 'b190c6b2-9a31-4ff4-b65c-43ebf27f9851',
      status: 'success',
      startedAt: '2026-08-27T12:00:00.000Z',
      completedAt: '2026-08-27T12:01:00.000Z',
      movieCount: 20,
      tvShowCount: 4,
      failureCode: null,
    };
    const service = createManualSyncTriggerService({
      runnerPath: '/fixed-runner.sh',
      runnerLock: runnerLock().lock,
      manualStatusStore: manualStore(existing).store,
      syncStatusStore: syncStore(null),
    });

    await expect(service.get(existing.runId)).resolves.toEqual(existing);
    await expect(
      service.get('e9061f74-812b-4ad2-87e8-4358eb099b85'),
    ).rejects.toBeInstanceOf(SyncRunNotFoundError);
  });
});
