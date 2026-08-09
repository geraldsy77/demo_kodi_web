import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { LibrarySummary } from '../types/librarySummary.js';

interface LibrarySummaryRow extends RowDataPacket {
  movieCount: number | string;
  tvShowCount: number | string;
}

export async function getLibrarySummary(
  pool: Pool,
): Promise<LibrarySummary> {
  const [rows] = await pool.execute<LibrarySummaryRow[]>(
    `SELECT
       (SELECT COUNT(idMovie) FROM movie) AS movieCount,
       (SELECT COUNT(idShow) FROM tvshow) AS tvShowCount`,
  );
  const summary = rows[0];

  if (!summary) {
    throw new Error('Library summary query returned no result');
  }

  return {
    movieCount: Number(summary.movieCount),
    tvShowCount: Number(summary.tvShowCount),
  };
}
