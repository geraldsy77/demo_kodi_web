import { readFile, rename, unlink, writeFile } from 'node:fs/promises';

import { z } from 'zod';

const stateSchema = z.object({
  snapshotId: z.string().min(1),
  version: z.number().int().positive(),
  phase: z.enum(['movies', 'tvshows', 'complete']),
  offset: z.number().int().nonnegative(),
  movieCount: z.number().int().nonnegative().default(0),
  tvShowCount: z.number().int().nonnegative().default(0),
});

export type SnapshotState = z.infer<typeof stateSchema>;

export interface SnapshotStateStore {
  load(): Promise<SnapshotState | null>;
  save(state: SnapshotState): Promise<void>;
  clear(): Promise<void>;
}

export function createFileSnapshotStateStore(filePath: string): SnapshotStateStore {
  const temporaryPath = `${filePath}.tmp`;
  return {
    async load() {
      try {
        return stateSchema.parse(JSON.parse(await readFile(filePath, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw new Error('Unable to read synchronization state.', { cause: error });
      }
    },
    async save(state) {
      await writeFile(temporaryPath, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, filePath);
    },
    async clear() {
      try {
        await unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
  };
}
