import {
  mkdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

export class SyncRunnerLockBusyError extends Error {
  constructor() {
    super('The synchronization runner lock is already held.');
    this.name = 'SyncRunnerLockBusyError';
  }
}

export interface SyncRunnerLockReservation {
  release(): Promise<void>;
}

export interface SyncRunnerLock {
  reserve(): Promise<SyncRunnerLockReservation>;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code;
}

async function readLockPid(pidFile: string): Promise<number | null> {
  try {
    const value = (await readFile(pidFile, 'utf8')).trim();

    if (!/^[1-9]\d*$/.test(value)) {
      return null;
    }

    return Number(value);
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !hasErrorCode(error, 'ESRCH');
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function createSyncRunnerLock(
  lockDirectory: string,
): SyncRunnerLock {
  const pidFile = path.join(lockDirectory, 'pid');

  async function removeStaleLock(): Promise<void> {
    const existingPid = await readLockPid(pidFile);

    if (existingPid !== null && isProcessRunning(existingPid)) {
      throw new SyncRunnerLockBusyError();
    }

    try {
      await unlink(pidFile);
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }

    try {
      await rmdir(lockDirectory);
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return;
      }

      // Something else entered the directory while it was being checked.
      if (hasErrorCode(error, 'ENOTEMPTY')) {
        throw new SyncRunnerLockBusyError();
      }

      throw error;
    }
  }

  return {
    async reserve() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await mkdir(lockDirectory, { mode: 0o700 });

          try {
            await writeFile(pidFile, `${process.pid}\n`, {
              encoding: 'utf8',
              mode: 0o600,
              flag: 'wx',
            });
          } catch (error) {
            await rmdir(lockDirectory).catch(() => undefined);
            throw error;
          }

          let released = false;

          return {
            async release() {
              if (released) return;
              released = true;

              const currentPid = await readLockPid(pidFile);

              // The shell runner replaces the API PID with its own PID when
              // it accepts ownership. It must then release the lock itself.
              if (currentPid !== process.pid) {
                return;
              }

              await unlink(pidFile).catch((error: unknown) => {
                if (!hasErrorCode(error, 'ENOENT')) {
                  throw error;
                }
              });

              await rmdir(lockDirectory).catch((error: unknown) => {
                if (
                  !hasErrorCode(error, 'ENOENT') &&
                  !hasErrorCode(error, 'ENOTEMPTY')
                ) {
                  throw error;
                }
              });
            },
          };
        } catch (error) {
          if (!hasErrorCode(error, 'EEXIST')) {
            throw error;
          }

          // Allow a process that just created the directory time to write
          // its PID before treating the lock as stale.
          await wait(250);
          await removeStaleLock();
        }
      }

      throw new SyncRunnerLockBusyError();
    },
  };
}