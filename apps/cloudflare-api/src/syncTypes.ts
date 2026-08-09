export interface SyncMovie {
  id: number;
  title: string;
  plot: string | null;
  premiered: string | null;
  userRating: number | null;
  rating: number | null;
  votes: number | null;
  playCount: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  resumePositionSeconds: number | null;
  resumeTotalSeconds: number | null;
  artworkUrl: string | null;
}

export interface SyncTvShow {
  id: number;
  title: string;
  plot: string | null;
  premiered: string | null;
  userRating: number | null;
  durationSeconds: number | null;
  rating: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  totalEpisodes: number | null;
  watchedEpisodes: number | null;
  totalSeasons: number | null;
  artworkUrl: string | null;
}

export interface SyncPayload {
  snapshotId: string;
  version: number;
  batchId: string;
  action: 'upsert' | 'complete';
  movies: SyncMovie[];
  tvShows: SyncTvShow[];
}
