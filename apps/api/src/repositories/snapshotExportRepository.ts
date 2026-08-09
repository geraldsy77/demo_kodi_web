import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { SnapshotMovie, SnapshotPage, SnapshotTvShow } from '../types/snapshot.js';
import { safeArtworkUrl } from './artworkUrl.js';

interface CountRow extends RowDataPacket { totalItems: number | string }
interface MovieRow extends RowDataPacket, Omit<SnapshotMovie, 'artworkUrl'> {
  artworkUrl: string | null;
}
interface TvShowRow extends RowDataPacket, Omit<
  SnapshotTvShow,
  'artworkUrl' | 'durationSeconds' | 'totalEpisodes' | 'watchedEpisodes' | 'totalSeasons'
> {
  artworkUrl: string | null;
  durationSeconds: number | string | null;
  totalEpisodes: number | string | null;
  watchedEpisodes: number | string | null;
  totalSeasons: number | string | null;
}

function nullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

export async function getSnapshotMoviePage(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<SnapshotPage<SnapshotMovie>> {
  const [countRows] = await pool.execute<CountRow[]>(
    'SELECT COUNT(idMovie) AS totalItems FROM movie',
  );
  const [rows] = await pool.execute<MovieRow[]>(`SELECT
    idMovie AS id, c00 AS title, c01 AS plot, premiered,
    userrating AS userRating, rating, votes, playCount, lastPlayed, dateAdded,
    resumeTimeInSeconds AS resumePositionSeconds,
    totalTimeInSeconds AS resumeTotalSeconds,
    (SELECT url FROM art WHERE media_id = idMovie AND media_type = 'movie'
      AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
    FROM movie_view
    ORDER BY idMovie ASC
    LIMIT ? OFFSET ?`, [limit, offset]);
  return {
    totalItems: Number(countRows[0]?.totalItems ?? 0),
    items: rows.map((row) => ({
      ...row,
      rating: nullableNumber(row.rating),
      userRating: nullableNumber(row.userRating),
      resumePositionSeconds: nullableNumber(row.resumePositionSeconds),
      resumeTotalSeconds: nullableNumber(row.resumeTotalSeconds),
      artworkUrl: safeArtworkUrl(row.artworkUrl),
    })),
  };
}

export async function getSnapshotTvShowPage(
  pool: Pool,
  limit: number,
  offset: number,
): Promise<SnapshotPage<SnapshotTvShow>> {
  const [countRows] = await pool.execute<CountRow[]>(
    'SELECT COUNT(idShow) AS totalItems FROM tvshow',
  );
  const [rows] = await pool.execute<TvShowRow[]>(`SELECT
    idShow AS id, c00 AS title, c01 AS plot, c05 AS premiered,
    userrating AS userRating, duration AS durationSeconds, rating, votes,
    lastPlayed, dateAdded, totalCount AS totalEpisodes,
    watchedcount AS watchedEpisodes, totalSeasons,
    (SELECT url FROM art WHERE media_id = idShow AND media_type = 'tvshow'
      AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
    FROM tvshow_view
    ORDER BY idShow ASC
    LIMIT ? OFFSET ?`, [limit, offset]);
  return {
    totalItems: Number(countRows[0]?.totalItems ?? 0),
    items: rows.map((row) => ({
      ...row,
      userRating: nullableNumber(row.userRating),
      durationSeconds: nullableNumber(row.durationSeconds),
      rating: nullableNumber(row.rating),
      totalEpisodes: nullableNumber(row.totalEpisodes),
      watchedEpisodes: nullableNumber(row.watchedEpisodes),
      totalSeasons: nullableNumber(row.totalSeasons),
      artworkUrl: safeArtworkUrl(row.artworkUrl),
    })),
  };
}
