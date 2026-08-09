import type { Pool } from 'mysql2/promise';

import { getSnapshotMoviePage, getSnapshotTvShowPage } from '../repositories/snapshotExportRepository.js';
import type { SnapshotPage, SnapshotMovie, SnapshotTvShow } from '../types/snapshot.js';
import type { SnapshotState, SnapshotStateStore } from './snapshotState.js';
import type { SnapshotUploader } from './snapshotUploader.js';

interface SyncDependencies {
  pool: Pool;
  uploader: SnapshotUploader;
  stateStore: SnapshotStateStore;
  batchSize: number;
  dryRun: boolean;
  now?: () => number;
  moviePage?: (pool: Pool, limit: number, offset: number) => Promise<SnapshotPage<SnapshotMovie>>;
  tvShowPage?: (pool: Pool, limit: number, offset: number) => Promise<SnapshotPage<SnapshotTvShow>>;
}

export interface SyncResult {
  snapshotId: string;
  version: number;
  movieCount: number;
  tvShowCount: number;
  dryRun: boolean;
}

function newState(now: () => number): SnapshotState {
  const version = now();
  return {
    snapshotId: `kodi-${version}`,
    version,
    phase: 'movies',
    offset: 0,
    movieCount: 0,
    tvShowCount: 0,
  };
}

export async function synchronizeKodiSnapshot(dependencies: SyncDependencies): Promise<SyncResult> {
  const moviePage = dependencies.moviePage ?? getSnapshotMoviePage;
  const tvShowPage = dependencies.tvShowPage ?? getSnapshotTvShowPage;
  const now = dependencies.now ?? Date.now;
  const state = dependencies.dryRun
    ? newState(now)
    : (await dependencies.stateStore.load() ?? newState(now));
  let movieCount = state.movieCount;
  let tvShowCount = state.tvShowCount;

  if (state.phase === 'movies') {
    let offset = state.offset;
    while (true) {
      const page = await moviePage(dependencies.pool, dependencies.batchSize, offset);
      movieCount = page.totalItems;
      state.movieCount = page.totalItems;
      if (page.items.length === 0) break;
      if (!dependencies.dryRun) {
        await dependencies.uploader.upload({
          snapshotId: state.snapshotId,
          version: state.version,
          batchId: `movies-${offset}`,
          action: 'upsert',
          movies: page.items,
          tvShows: [],
        });
        await dependencies.stateStore.save({ ...state, phase: 'movies', offset: offset + page.items.length });
      }
      offset += page.items.length;
    }
    state.phase = 'tvshows';
    state.offset = 0;
    if (!dependencies.dryRun) await dependencies.stateStore.save(state);
  }

  if (state.phase === 'tvshows') {
    let offset = state.offset;
    while (true) {
      const page = await tvShowPage(dependencies.pool, dependencies.batchSize, offset);
      tvShowCount = page.totalItems;
      state.tvShowCount = page.totalItems;
      if (page.items.length === 0) break;
      if (!dependencies.dryRun) {
        await dependencies.uploader.upload({
          snapshotId: state.snapshotId,
          version: state.version,
          batchId: `tvshows-${offset}`,
          action: 'upsert',
          movies: [],
          tvShows: page.items,
        });
        await dependencies.stateStore.save({ ...state, phase: 'tvshows', offset: offset + page.items.length });
      }
      offset += page.items.length;
    }
    state.phase = 'complete';
    state.offset = 0;
    if (!dependencies.dryRun) await dependencies.stateStore.save(state);
  }

  if (!dependencies.dryRun) {
    await dependencies.uploader.upload({
      snapshotId: state.snapshotId,
      version: state.version,
      batchId: 'complete',
      action: 'complete',
      movies: [],
      tvShows: [],
    });
    await dependencies.stateStore.clear();
  }

  return { snapshotId: state.snapshotId, version: state.version, movieCount, tvShowCount, dryRun: dependencies.dryRun };
}
