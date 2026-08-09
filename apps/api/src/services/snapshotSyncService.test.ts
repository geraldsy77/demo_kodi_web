import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import type { SnapshotState, SnapshotStateStore } from './snapshotState.js';
import { synchronizeKodiSnapshot } from './snapshotSyncService.js';

function movie(id: number) {
  return {
    id, title: `Movie ${id}`, plot: null, premiered: null, userRating: null,
    rating: null, votes: null, playCount: null, lastPlayed: null, dateAdded: null,
    resumePositionSeconds: null, resumeTotalSeconds: null, artworkUrl: null,
  };
}

function memoryState(initial: SnapshotState | null = null) {
  let state = initial;
  const store: SnapshotStateStore = {
    load: vi.fn(async () => state),
    save: vi.fn(async (value) => { state = { ...value }; }),
    clear: vi.fn(async () => { state = null; }),
  };
  return { store, current: () => state };
}

describe('snapshot synchronization service', () => {
  it('uploads a full snapshot in deterministic batches and completes it', async () => {
    const state = memoryState();
    const upload = vi.fn().mockResolvedValue(undefined);
    const result = await synchronizeKodiSnapshot({
      pool: {} as Pool, uploader: { upload }, stateStore: state.store,
      batchSize: 2, dryRun: false, now: () => 1000,
      moviePage: vi.fn(async (_pool, _limit, offset) => ({
        totalItems: 3,
        items: offset === 0 ? [movie(1), movie(2)] : offset === 2 ? [movie(3)] : [],
      })),
      tvShowPage: vi.fn(async () => ({ items: [], totalItems: 0 })),
    });

    expect(upload.mock.calls.map(([value]) => value.batchId)).toEqual([
      'movies-0', 'movies-2', 'complete',
    ]);
    expect(upload.mock.calls.at(-1)?.[0]).toMatchObject({ action: 'complete' });
    expect(state.store.clear).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ movieCount: 3, tvShowCount: 0, dryRun: false });
  });

  it('resumes after interruption from the last persisted offset', async () => {
    const state = memoryState();
    const failingUpload = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('interrupted'));
    const moviePage = vi.fn(async (_pool: Pool, _limit: number, offset: number) => ({
      totalItems: 2,
      items: offset === 0 ? [movie(1)] : offset === 1 ? [movie(2)] : [],
    }));
    const tvShowPage = vi.fn(async () => ({ items: [], totalItems: 0 }));
    const base = {
      pool: {} as Pool, stateStore: state.store, batchSize: 1, dryRun: false,
      now: () => 2000, moviePage, tvShowPage,
    };

    await expect(synchronizeKodiSnapshot({ ...base, uploader: { upload: failingUpload } }))
      .rejects.toThrow('interrupted');
    expect(state.current()).toMatchObject({ snapshotId: 'kodi-2000', phase: 'movies', offset: 1 });

    const resumedUpload = vi.fn().mockResolvedValue(undefined);
    await synchronizeKodiSnapshot({ ...base, uploader: { upload: resumedUpload } });
    expect(resumedUpload.mock.calls[0]?.[0]).toMatchObject({
      snapshotId: 'kodi-2000', batchId: 'movies-1',
    });
    expect(resumedUpload.mock.calls.at(-1)?.[0]).toMatchObject({ action: 'complete' });
    expect(state.current()).toBeNull();
  });

  it('dry-runs the complete export without uploading or writing resume state', async () => {
    const state = memoryState();
    const upload = vi.fn();
    const result = await synchronizeKodiSnapshot({
      pool: {} as Pool, uploader: { upload }, stateStore: state.store,
      batchSize: 50, dryRun: true, now: () => 3000,
      moviePage: vi.fn(async (_pool, _limit, offset) => ({
        items: offset === 0 ? [movie(1)] : [], totalItems: 1,
      })),
      tvShowPage: vi.fn(async () => ({ items: [], totalItems: 0 })),
    });
    expect(result).toMatchObject({ movieCount: 1, tvShowCount: 0, dryRun: true });
    expect(upload).not.toHaveBeenCalled();
    expect(state.store.save).not.toHaveBeenCalled();
    expect(state.store.clear).not.toHaveBeenCalled();
  });
});
