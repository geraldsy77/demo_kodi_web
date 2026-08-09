import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { MovieDetail, MovieListItem } from '../types/movie.js';
import { safeArtworkUrl } from './artworkUrl.js';

interface MovieRow extends RowDataPacket {
  id: number;
  title: string;
  premiered: string | null;
  rating: number | null;
  playCount: number | null;
  artworkUrl: string | null;
}

interface MovieCountRow extends RowDataPacket {
  totalItems: number | string;
}

interface MovieDetailRow extends RowDataPacket {
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
  resumeTimeInSeconds: number | null;
  totalTimeInSeconds: number | null;
}

interface MoviePageOptions {
  limit: number;
  offset: number;
}

export interface MoviePageResult {
  items: MovieListItem[];
  totalItems: number;
}

export async function getMoviePage(
  pool: Pool,
  options: MoviePageOptions,
): Promise<MoviePageResult> {
  const [countRows] = await pool.execute<MovieCountRow[]>(
    'SELECT COUNT(idMovie) AS totalItems FROM movie',
  );
  const [rows] = await pool.execute<MovieRow[]>(
    `SELECT
       idMovie AS id,
       c00 AS title,
       premiered,
       rating,
       playCount
       ,(SELECT url FROM art WHERE media_id = idMovie AND media_type = 'movie' AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
     FROM movie_view
     ORDER BY c00 ASC, idMovie ASC
     LIMIT ? OFFSET ?`,
    [options.limit, options.offset],
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      premiered: row.premiered,
      rating: row.rating === null ? null : Number(row.rating),
      playCount: row.playCount,
      artworkUrl: safeArtworkUrl(row.artworkUrl),
    })),
    totalItems: Number(countRows[0]?.totalItems ?? 0),
  };
}

export async function getMovieById(
  pool: Pool,
  movieId: number,
): Promise<MovieDetail | null> {
  const [rows] = await pool.execute<MovieDetailRow[]>(
    `SELECT
       idMovie AS id,
       c00 AS title,
       c01 AS plot,
       premiered,
       userrating AS userRating,
       rating,
       votes,
       playCount,
       lastPlayed,
       dateAdded,
       resumeTimeInSeconds,
       totalTimeInSeconds
       ,(SELECT url FROM art WHERE media_id = idMovie AND media_type = 'movie' AND type = 'poster' ORDER BY art_id ASC LIMIT 1) AS artworkUrl
     FROM movie_view
     WHERE idMovie = ?
     LIMIT 1`,
    [movieId],
  );
  const row = rows[0];

  if (!row) return null;

  const hasResume =
    row.resumeTimeInSeconds !== null && row.totalTimeInSeconds !== null;

  return {
    id: row.id,
    title: row.title,
    plot: row.plot,
    premiered: row.premiered,
    userRating: row.userRating,
    rating: row.rating === null ? null : Number(row.rating),
    votes: row.votes,
    playCount: row.playCount,
    artworkUrl: safeArtworkUrl(row.artworkUrl),
    lastPlayed: row.lastPlayed,
    dateAdded: row.dateAdded,
    resume: hasResume
      ? {
          positionSeconds: Number(row.resumeTimeInSeconds),
          totalSeconds: Number(row.totalTimeInSeconds),
        }
      : null,
  };
}
