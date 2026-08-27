import {
  mkdtemp,
  readFile,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createManualSyncRunStore,
  type ManualSyncRun,
} from './manualSyncRunStore.js';

const temporaryDirectories: string[] = [];

async function temporaryFile(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'kodi-manual-sync-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'status.json');
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('createManualSyncRunStore', () => {
  it('returns null when no run has been persisted', async () => {
    const store = createManualSyncRunStore(await temporaryFile());
    await expect(store.load()).resolves.toBeNull();
  });

  it('atomically persists and validates safe run status', async () => {
    const filePath = await temporaryFile();
    const store = createManualSyncRunStore(filePath);
    const run: ManualSyncRun = {
      runId: 'b190c6b2-9a31-4ff4-b65c-43ebf27f9851',
      status: 'success',
      startedAt: '2026-08-27T12:00:00.000Z',
      completedAt: '2026-08-27T12:01:00.000Z',
      movieCount: 20,
      tvShowCount: 4,
      failureCode: null,
    };

    await store.save(run);

    await expect(store.load()).resolves.toEqual(run);
    await expect(readFile(`${filePath}.tmp`, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(filePath, 'utf8')).not.toContain('token');

    if (process.platform !== 'win32') {
      expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    }
  });
});
