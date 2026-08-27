import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSyncRunnerLock,
  SyncRunnerLockBusyError,
} from './syncRunnerLock.js';

const temporaryDirectories: string[] = [];

async function temporaryLockDirectory(): Promise<{
  root: string;
  lock: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'kodi-sync-lock-'));
  temporaryDirectories.push(root);
  return { root, lock: path.join(root, 'runner.lock') };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('createSyncRunnerLock', () => {
  it('atomically reserves and releases the shared lock', async () => {
    const { lock } = await temporaryLockDirectory();
    const reservation = await createSyncRunnerLock(lock).reserve();

    await expect(
      readFile(path.join(lock, 'pid'), 'utf8'),
    ).resolves.toBe(`${process.pid}\n`);

    await reservation.release();
    await expect(readFile(path.join(lock, 'pid'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects a second reservation while a live process owns the lock', async () => {
    const { lock } = await temporaryLockDirectory();
    const first = await createSyncRunnerLock(lock).reserve();

    await expect(createSyncRunnerLock(lock).reserve()).rejects.toBeInstanceOf(
      SyncRunnerLockBusyError,
    );

    await first.release();
  });

  it('recovers a lock owned by a process that no longer exists', async () => {
    const { lock } = await temporaryLockDirectory();
    await mkdir(lock, { mode: 0o700 });
    await writeFile(path.join(lock, 'pid'), '2147483647\n', {
      mode: 0o600,
    });

    const reservation = await createSyncRunnerLock(lock).reserve();

    await expect(
      readFile(path.join(lock, 'pid'), 'utf8'),
    ).resolves.toBe(`${process.pid}\n`);
    await reservation.release();
  });
});
