import { readFile, rename, writeFile } from 'node:fs/promises';

import { z } from 'zod';

const manualSyncRunSchema = z.object({
  runId: z.string().uuid(),
  status: z.enum(['running', 'success', 'failure']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  movieCount: z.number().int().nonnegative().nullable(),
  tvShowCount: z.number().int().nonnegative().nullable(),
  failureCode: z.enum([
    'SYNC_FAILED',
    'RUNNER_START_FAILED',
    'STATUS_UNAVAILABLE',
  ]).nullable(),
});

export type ManualSyncRun = z.infer<typeof manualSyncRunSchema>;

export interface ManualSyncRunStore {
  load(): Promise<ManualSyncRun | null>;
  save(status: ManualSyncRun): Promise<void>;
}

export function createManualSyncRunStore(
  filePath: string,
): ManualSyncRunStore {
  const temporaryPath = `${filePath}.tmp`;

  return {
    async load() {
      try {
        const content = await readFile(filePath, 'utf8');
        return manualSyncRunSchema.parse(JSON.parse(content));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;

        throw new Error('Unable to read manual synchronization status.', {
          cause: error,
        });
      }
    },

    async save(status) {
      await writeFile(
        temporaryPath,
        `${JSON.stringify(status)}\n`,
        {
          encoding: 'utf8',
          mode: 0o600,
        },
      );

      await rename(temporaryPath, filePath);
    },
  };
}