import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { TvShowDetail, TvShowListItem } from '../types/tvShow.js';
import { safeArtworkUrl } from './artworkUrl.js';

interface TvShowRow extends RowDataPacket {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  totalEpisodes: number | string | null;
  watchedEpisodes: number | string | null;
  totalSeasons: number | string | null;
  artworkUrl: string | null;
}

interface TvShowCountRow extends RowDataPacket {
  totalItems: number | string;
}

interface TvShowDetailRow extends TvShowRow {
  plot: string | null;
  userRating: number | null;
  durationSeconds: number | string | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
}

interface TvShowPageOptions {
  limit: number;
  offset: number;
}

export interface TvShowPageResult {
  items: TvShowListItem[];
  totalItems: number;
}

function nullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

export async function getTvShowPage(
  pool: Pool,
  options: TvShowPageOptions,
): Promise<TvShowPageResult> {
  const [countRows] = await pool.execute<TvShowCountRow[]>(
    'SELECT COUNT(idShow) AS totalItems FROM tvshow',
  );
  const [rows] = await pool.execute<TvShowRow[]>(
    `SELECT
       idShow AS id,
       c00 AS title,
       c05 AS premiered,
       rating,
       totalCount AS totalEpisodes,
       watchedcount AS watchedEpisodes,
       totalSeasons
       ,(SELECT url FROM art WHERE media_id = idShow AND media_type = 'tvshow' AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
     FROM tvshow_view
     ORDER BY c00 ASC, idShow ASC
     LIMIT ? OFFSET ?`,
    [options.limit, options.offset],
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      premiered: row.premiered,
      rating: nullableNumber(row.rating),
      totalEpisodes: nullableNumber(row.totalEpisodes),
      watchedEpisodes: nullableNumber(row.watchedEpisodes),
      totalSeasons: nullableNumber(row.totalSeasons),
      artworkUrl: safeArtworkUrl(row.artworkUrl),
    })),
    totalItems: Number(countRows[0]?.totalItems ?? 0),
  };
}

export async function getTvShowById(
  pool: Pool,
  tvShowId: number,
): Promise<TvShowDetail | null> {
  const [rows] = await pool.execute<TvShowDetailRow[]>(
    `SELECT
       idShow AS id,
       c00 AS title,
       c01 AS plot,
       c05 AS premiered,
       userrating AS userRating,
       duration AS durationSeconds,
       rating,
       votes,
       lastPlayed,
       dateAdded,
       totalCount AS totalEpisodes,
       watchedcount AS watchedEpisodes,
       totalSeasons
       ,(SELECT url FROM art WHERE media_id = idShow AND media_type = 'tvshow' AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
     FROM tvshow_view
     WHERE idShow = ?
     LIMIT 1`,
    [tvShowId],
  );
  const row = rows[0];

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    plot: row.plot,
    premiered: row.premiered,
    userRating: nullableNumber(row.userRating),
    durationSeconds: nullableNumber(row.durationSeconds),
    rating: nullableNumber(row.rating),
    votes: row.votes,
    lastPlayed: row.lastPlayed,
    dateAdded: row.dateAdded,
    totalEpisodes: nullableNumber(row.totalEpisodes),
    watchedEpisodes: nullableNumber(row.watchedEpisodes),
    totalSeasons: nullableNumber(row.totalSeasons),
    artworkUrl: safeArtworkUrl(row.artworkUrl),
  };
}
