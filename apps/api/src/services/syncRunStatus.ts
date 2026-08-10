import { readFile, rename, writeFile } from 'node:fs/promises';

import { z } from 'zod';

const syncRunStatusSchema = z.object({
  lastAttemptAt: z.string().datetime(),
  lastSuccessAt: z.string().datetime().nullable(),
  lastFailureAt: z.string().datetime().nullable(),
  outcome: z.enum(['success', 'failure']),
  durationMilliseconds: z.number().int().nonnegative(),
  movieCount: z.number().int().nonnegative().nullable(),
  tvShowCount: z.number().int().nonnegative().nullable(),
  failureCode: z.literal('SYNC_FAILED').nullable(),
});

export type SyncRunStatus = z.infer<typeof syncRunStatusSchema>;

export interface SyncRunStatusStore {
  load(): Promise<SyncRunStatus | null>;
  save(status: SyncRunStatus): Promise<void>;
}

export function createFileSyncRunStatusStore(filePath: string): SyncRunStatusStore {
  const temporaryPath = `${filePath}.tmp`;
  return {
    async load() {
      try {
        return syncRunStatusSchema.parse(JSON.parse(await readFile(filePath, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw new Error('Unable to read synchronization run status.', { cause: error });
      }
    },
    async save(status) {
      await writeFile(temporaryPath, `${JSON.stringify(status)}\n`, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, filePath);
    },
  };
}

interface SyncCounts { movieCount: number; tvShowCount: number }

export async function observeSyncRun<T extends SyncCounts>(
  operation: () => Promise<T>,
  store: SyncRunStatusStore,
  now: () => Date = () => new Date(),
): Promise<T> {
  const startedAt = now();
  const previous = await store.load();
  try {
    const result = await operation();
    const completedAt = now();
    await store.save({
      lastAttemptAt: completedAt.toISOString(),
      lastSuccessAt: completedAt.toISOString(),
      lastFailureAt: previous?.lastFailureAt ?? null,
      outcome: 'success',
      durationMilliseconds: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      movieCount: result.movieCount,
      tvShowCount: result.tvShowCount,
      failureCode: null,
    });
    return result;
  } catch (error) {
    const failedAt = now();
    await store.save({
      lastAttemptAt: failedAt.toISOString(),
      lastSuccessAt: previous?.lastSuccessAt ?? null,
      lastFailureAt: failedAt.toISOString(),
      outcome: 'failure',
      durationMilliseconds: Math.max(0, failedAt.getTime() - startedAt.getTime()),
      movieCount: previous?.movieCount ?? null,
      tvShowCount: previous?.tvShowCount ?? null,
      failureCode: 'SYNC_FAILED',
    });
    throw error;
  }
}
