import { ApiError } from './http';
import type { SyncMovie, SyncPayload, SyncTvShow } from './syncTypes';

const RATE_LIMIT_MAX = 30;
const RATE_WINDOW_SECONDS = 60;

interface SnapshotRow {
  id: string;
  version: number;
  isActive: number;
}

interface BatchRow { payloadSha256: string }
interface CountRow { total: number }
interface RateRow { requestCount: number }

function movieStatement(db: D1Database, snapshotId: string, movie: SyncMovie): D1PreparedStatement {
  return db.prepare(`INSERT INTO movies (
    snapshot_id, id, title, search_title, plot, premiered, user_rating, rating, votes,
    play_count, last_played, date_added, resume_position_seconds, resume_total_seconds,
    artwork_url
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
  ON CONFLICT(snapshot_id, id) DO UPDATE SET
    title = excluded.title, search_title = excluded.search_title, plot = excluded.plot,
    premiered = excluded.premiered, user_rating = excluded.user_rating,
    rating = excluded.rating, votes = excluded.votes, play_count = excluded.play_count,
    last_played = excluded.last_played, date_added = excluded.date_added,
    resume_position_seconds = excluded.resume_position_seconds,
    resume_total_seconds = excluded.resume_total_seconds, artwork_url = excluded.artwork_url`).bind(
    snapshotId, movie.id, movie.title, movie.title.toLowerCase(), movie.plot,
    movie.premiered, movie.userRating, movie.rating, movie.votes, movie.playCount,
    movie.lastPlayed, movie.dateAdded, movie.resumePositionSeconds,
    movie.resumeTotalSeconds, movie.artworkUrl,
  );
}

function tvShowStatement(db: D1Database, snapshotId: string, show: SyncTvShow): D1PreparedStatement {
  return db.prepare(`INSERT INTO tv_shows (
    snapshot_id, id, title, search_title, plot, premiered, user_rating, duration_seconds,
    rating, votes, last_played, date_added, total_episodes, watched_episodes,
    total_seasons, artwork_url
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
  ON CONFLICT(snapshot_id, id) DO UPDATE SET
    title = excluded.title, search_title = excluded.search_title, plot = excluded.plot,
    premiered = excluded.premiered, user_rating = excluded.user_rating,
    duration_seconds = excluded.duration_seconds, rating = excluded.rating,
    votes = excluded.votes, last_played = excluded.last_played,
    date_added = excluded.date_added, total_episodes = excluded.total_episodes,
    watched_episodes = excluded.watched_episodes, total_seasons = excluded.total_seasons,
    artwork_url = excluded.artwork_url`).bind(
    snapshotId, show.id, show.title, show.title.toLowerCase(), show.plot, show.premiered,
    show.userRating, show.durationSeconds, show.rating, show.votes, show.lastPlayed,
    show.dateAdded, show.totalEpisodes, show.watchedEpisodes, show.totalSeasons,
    show.artworkUrl,
  );
}

export async function enforceSyncRateLimit(
  db: D1Database,
  clientKey: string,
  nowSeconds: number,
): Promise<void> {
  const windowStart = Math.floor(nowSeconds / RATE_WINDOW_SECONDS) * RATE_WINDOW_SECONDS;
  const row = await db.prepare(`INSERT INTO sync_rate_limits (client_key, window_start, request_count)
    VALUES (?1, ?2, 1)
    ON CONFLICT(client_key, window_start) DO UPDATE SET request_count = request_count + 1
    RETURNING request_count AS requestCount`).bind(clientKey, windowStart).first<RateRow>();
  if (Number(row?.requestCount ?? 0) > RATE_LIMIT_MAX) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many synchronization requests.', {
      'Retry-After': String(RATE_WINDOW_SECONDS),
    });
  }
}

async function findSnapshot(db: D1Database, snapshotId: string): Promise<SnapshotRow | null> {
  return db.prepare(`SELECT id, version, is_active AS isActive
    FROM sync_snapshots WHERE id = ?1 LIMIT 1`).bind(snapshotId).first<SnapshotRow>();
}

async function findLatestVersion(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COALESCE(MAX(version), 0) AS total
    FROM sync_snapshots`).first<CountRow>();
  return Number(row?.total ?? 0);
}

async function findBatch(
  db: D1Database,
  snapshotId: string,
  batchId: string,
): Promise<BatchRow | null> {
  return db.prepare(`SELECT payload_sha256 AS payloadSha256 FROM sync_batches
    WHERE snapshot_id = ?1 AND batch_id = ?2 LIMIT 1`)
    .bind(snapshotId, batchId).first<BatchRow>();
}

async function counts(db: D1Database, snapshotId: string) {
  const [movies, tvShows] = await db.batch<CountRow>([
    db.prepare('SELECT COUNT(id) AS total FROM movies WHERE snapshot_id = ?1').bind(snapshotId),
    db.prepare('SELECT COUNT(id) AS total FROM tv_shows WHERE snapshot_id = ?1').bind(snapshotId),
  ]);
  return {
    movieCount: Number(movies.results[0]?.total ?? 0),
    tvShowCount: Number(tvShows.results[0]?.total ?? 0),
  };
}

function batchMetadataStatement(
  db: D1Database,
  payload: SyncPayload,
  payloadHash: string,
  now: string,
): D1PreparedStatement {
  return db.prepare(`INSERT INTO sync_batches (
    snapshot_id, batch_id, payload_sha256, action, movie_count, tv_show_count, received_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`).bind(
    payload.snapshotId, payload.batchId, payloadHash, payload.action,
    payload.movies.length, payload.tvShows.length, now,
  );
}

function auditStatement(
  db: D1Database,
  payload: SyncPayload,
  outcome: 'accepted' | 'completed' | 'duplicate',
  now: string,
): D1PreparedStatement {
  return db.prepare(`INSERT INTO sync_audit_log (
    id, snapshot_id, snapshot_version, batch_id, action, outcome,
    movie_count, tv_show_count, received_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`).bind(
    crypto.randomUUID(), payload.snapshotId, payload.version, payload.batchId,
    payload.action, outcome, payload.movies.length, payload.tvShows.length, now,
  );
}

export async function ingestSnapshotBatch(
  db: D1Database,
  payload: SyncPayload,
  payloadHash: string,
  now: string,
) {
  const existingSnapshot = await findSnapshot(db, payload.snapshotId);
  if (existingSnapshot && existingSnapshot.version !== payload.version) {
    throw new ApiError(409, 'SNAPSHOT_CONFLICT', 'Snapshot identifier already uses another version.');
  }
  const existingBatch = await findBatch(db, payload.snapshotId, payload.batchId);
  if (existingBatch) {
    if (existingBatch.payloadSha256 !== payloadHash) {
      throw new ApiError(409, 'BATCH_CONFLICT', 'Batch identifier was already used for different data.');
    }
    const result = await counts(db, payload.snapshotId);
    await auditStatement(db, payload, 'duplicate', now).run();
    return { ...result, status: existingSnapshot?.isActive ? 'completed' : 'accepted', duplicate: true };
  }

  const latestVersion = await findLatestVersion(db);
  if (payload.version < latestVersion || (!existingSnapshot && payload.version <= latestVersion)) {
    throw new ApiError(409, 'STALE_SNAPSHOT', 'Snapshot version is stale.');
  }

  if (existingSnapshot?.isActive === 1 && payload.action !== 'complete') {
    throw new ApiError(409, 'SNAPSHOT_COMPLETED', 'Completed snapshots cannot accept more records.');
  }

  if (payload.action === 'upsert') {
    const statements: D1PreparedStatement[] = [];
    if (!existingSnapshot) {
      statements.push(db.prepare(`INSERT INTO sync_snapshots
        (id, created_at, completed_at, is_active, version)
        VALUES (?1, ?2, NULL, 0, ?3)`).bind(payload.snapshotId, now, payload.version));
    }
    statements.push(
      ...payload.movies.map((movie) => movieStatement(db, payload.snapshotId, movie)),
      ...payload.tvShows.map((show) => tvShowStatement(db, payload.snapshotId, show)),
      batchMetadataStatement(db, payload, payloadHash, now),
      auditStatement(db, payload, 'accepted', now),
    );
    await db.batch(statements);
    return { ...await counts(db, payload.snapshotId), status: 'accepted', duplicate: false };
  }

  if (!existingSnapshot) {
    throw new ApiError(409, 'SNAPSHOT_NOT_FOUND', 'Snapshot must receive an upload batch before completion.');
  }
  await db.batch([
    db.prepare('UPDATE sync_snapshots SET is_active = 0 WHERE is_active = 1'),
    db.prepare(`UPDATE sync_snapshots SET is_active = 1, completed_at = ?1
      WHERE id = ?2`).bind(now, payload.snapshotId),
    batchMetadataStatement(db, payload, payloadHash, now),
    auditStatement(db, payload, 'completed', now),
    db.prepare('DELETE FROM sync_snapshots WHERE id <> ?1').bind(payload.snapshotId),
    db.prepare('DELETE FROM sync_rate_limits WHERE window_start < ?1')
      .bind(Math.floor(Date.parse(now) / 1000) - RATE_WINDOW_SECONDS),
  ]);
  return { ...await counts(db, payload.snapshotId), status: 'completed', duplicate: false };
}
