import type {
  MovieDetail,
  MovieListItem,
  SearchResultItem,
  TvShowDetail,
  TvShowListItem,
} from './types';

const activeSnapshot = `(
  SELECT id FROM sync_snapshots WHERE is_active = 1 LIMIT 1
)`;

interface CountRow { totalItems: number }

interface ActiveSnapshotRow {
  createdAt: string;
  completedAt: string;
}

export interface SyncStatus {
  status: 'current' | 'stale' | 'never_synced';
  stale: boolean;
  lastSuccessAt: string | null;
  durationSeconds: number | null;
  movieCount: number;
  tvShowCount: number;
}

interface MovieListRow {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  playCount: number | null;
  artworkUrl: string | null;
}

interface MovieDetailRow extends MovieListRow {
  plot: string | null;
  userRating: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  resumePositionSeconds: number | null;
  resumeTotalSeconds: number | null;
}

interface TvShowListRow {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  totalEpisodes: number | null;
  watchedEpisodes: number | null;
  totalSeasons: number | null;
  artworkUrl: string | null;
}

interface TvShowDetailRow extends TvShowListRow {
  plot: string | null;
  userRating: number | null;
  durationSeconds: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
}

export async function getSummary(db: D1Database) {
  const [movies, tvShows] = await db.batch<CountRow>([
    db.prepare(`SELECT COUNT(id) AS totalItems FROM movies WHERE snapshot_id = ${activeSnapshot}`),
    db.prepare(`SELECT COUNT(id) AS totalItems FROM tv_shows WHERE snapshot_id = ${activeSnapshot}`),
  ]);
  return {
    movieCount: Number(movies.results[0]?.totalItems ?? 0),
    tvShowCount: Number(tvShows.results[0]?.totalItems ?? 0),
  };
}

export async function getSyncStatus(
  db: D1Database,
  staleAfterSeconds: number,
  now = Date.now(),
): Promise<SyncStatus> {
  const snapshot = await db.prepare(`SELECT
    created_at AS createdAt, completed_at AS completedAt
    FROM sync_snapshots
    WHERE is_active = 1 AND completed_at IS NOT NULL
    LIMIT 1`).first<ActiveSnapshotRow>();
  if (!snapshot) {
    return {
      status: 'never_synced', stale: true, lastSuccessAt: null,
      durationSeconds: null, movieCount: 0, tvShowCount: 0,
    };
  }
  const counts = await getSummary(db);
  const completedAt = Date.parse(snapshot.completedAt);
  const createdAt = Date.parse(snapshot.createdAt);
  const stale = !Number.isFinite(completedAt) || now - completedAt > staleAfterSeconds * 1000;
  return {
    status: stale ? 'stale' : 'current',
    stale,
    lastSuccessAt: snapshot.completedAt,
    durationSeconds: Number.isFinite(createdAt) && Number.isFinite(completedAt)
      ? Math.max(0, Math.round((completedAt - createdAt) / 1000))
      : null,
    ...counts,
  };
}

export async function getMovies(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<{ items: MovieListItem[]; totalItems: number }> {
  const [count, rows] = await db.batch<CountRow | MovieListRow>([
    db.prepare(`SELECT COUNT(id) AS totalItems FROM movies WHERE snapshot_id = ${activeSnapshot}`),
    db.prepare(`SELECT
      id, title, premiered, rating, play_count AS playCount,
      artwork_url AS artworkUrl
      FROM movies
      WHERE snapshot_id = ${activeSnapshot}
      ORDER BY date_added IS NULL ASC, date_added DESC,
        title COLLATE NOCASE ASC, id ASC
      LIMIT ?1 OFFSET ?2`).bind(limit, offset),
  ]);
  return {
    items: rows.results as MovieListItem[],
    totalItems: Number((count.results[0] as CountRow | undefined)?.totalItems ?? 0),
  };
}

export async function getMovie(db: D1Database, id: number): Promise<MovieDetail | null> {
  const row = await db.prepare(`SELECT
    id, title, plot, premiered, user_rating AS userRating, rating, votes,
    play_count AS playCount, last_played AS lastPlayed, date_added AS dateAdded,
    resume_position_seconds AS resumePositionSeconds,
    resume_total_seconds AS resumeTotalSeconds, artwork_url AS artworkUrl
    FROM movies
    WHERE snapshot_id = ${activeSnapshot} AND id = ?1
    LIMIT 1`).bind(id).first<MovieDetailRow>();
  if (!row) return null;
  const { resumePositionSeconds, resumeTotalSeconds, ...movie } = row;
  return {
    ...movie,
    resume: resumePositionSeconds !== null && resumeTotalSeconds !== null
      ? { positionSeconds: resumePositionSeconds, totalSeconds: resumeTotalSeconds }
      : null,
  };
}

export async function getTvShows(
  db: D1Database,
  limit: number,
  offset: number,
): Promise<{ items: TvShowListItem[]; totalItems: number }> {
  const [count, rows] = await db.batch<CountRow | TvShowListRow>([
    db.prepare(`SELECT COUNT(id) AS totalItems FROM tv_shows WHERE snapshot_id = ${activeSnapshot}`),
    db.prepare(`SELECT
      id, title, premiered, rating, total_episodes AS totalEpisodes,
      watched_episodes AS watchedEpisodes, total_seasons AS totalSeasons,
      artwork_url AS artworkUrl
      FROM tv_shows
      WHERE snapshot_id = ${activeSnapshot}
      ORDER BY date_added IS NULL ASC, date_added DESC,
        title COLLATE NOCASE ASC, id ASC
      LIMIT ?1 OFFSET ?2`).bind(limit, offset),
  ]);
  return {
    items: rows.results as TvShowListItem[],
    totalItems: Number((count.results[0] as CountRow | undefined)?.totalItems ?? 0),
  };
}

export async function getTvShow(db: D1Database, id: number): Promise<TvShowDetail | null> {
  return db.prepare(`SELECT
    id, title, plot, premiered, user_rating AS userRating,
    duration_seconds AS durationSeconds, rating, votes,
    last_played AS lastPlayed, date_added AS dateAdded,
    total_episodes AS totalEpisodes, watched_episodes AS watchedEpisodes,
    total_seasons AS totalSeasons, artwork_url AS artworkUrl
    FROM tv_shows
    WHERE snapshot_id = ${activeSnapshot} AND id = ?1
    LIMIT 1`).bind(id).first<TvShowDetailRow>();
}

export async function search(
  db: D1Database,
  query: string,
  limit: number,
  offset: number,
): Promise<{ items: SearchResultItem[]; totalItems: number }> {
  const normalized = query.toLowerCase();
  const count = await db.prepare(`SELECT COUNT(id) AS totalItems FROM (
    SELECT id FROM movies
      WHERE snapshot_id = ${activeSnapshot} AND instr(search_title, ?1) > 0
    UNION ALL
    SELECT id FROM tv_shows
      WHERE snapshot_id = ${activeSnapshot} AND instr(search_title, ?1) > 0
  )`).bind(normalized).first<CountRow>();
  const rows = await db.prepare(`SELECT id, title, entityType FROM (
    SELECT id, title, 'movie' AS entityType FROM movies
      WHERE snapshot_id = ${activeSnapshot} AND instr(search_title, ?1) > 0
    UNION ALL
    SELECT id, title, 'tvshow' AS entityType FROM tv_shows
      WHERE snapshot_id = ${activeSnapshot} AND instr(search_title, ?1) > 0
  )
  ORDER BY title COLLATE NOCASE ASC, entityType ASC, id ASC
  LIMIT ?2 OFFSET ?3`).bind(normalized, limit, offset).all<SearchResultItem>();
  return {
    items: rows.results,
    totalItems: Number(count?.totalItems ?? 0),
  };
}
