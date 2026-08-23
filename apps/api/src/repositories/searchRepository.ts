import type { Pool, RowDataPacket } from 'mysql2/promise';

interface SearchRow extends RowDataPacket {
  id: number;
  title: string;
  entityType: 'movie' | 'tvshow';
}

interface SearchCountRow extends RowDataPacket {
  totalItems: number | string;
}

interface SearchPageOptions {
  query: string;
  limit: number;
  offset: number;
}

export interface SearchPageResult {
  items: Array<{ id: number; title: string; entityType: 'movie' | 'tvshow' }>;
  totalItems: number;
}

export async function searchLibrary(
  pool: Pool,
  options: SearchPageOptions,
): Promise<SearchPageResult> {
  const [countRows] = await pool.execute<SearchCountRow[]>(
    `SELECT
       (SELECT COUNT(idMovie) FROM movie WHERE INSTR(c00, ?) > 0) +
       (SELECT COUNT(idShow) FROM tvshow WHERE INSTR(c00, ?) > 0)
       AS totalItems`,
    [options.query, options.query],
  );
  const [rows] = await pool.execute<SearchRow[]>(
    `SELECT id, title, entityType
     FROM (
       SELECT idMovie AS id, c00 AS title, 'movie' AS entityType
       FROM movie
       WHERE INSTR(c00, ?) > 0
       UNION ALL
       SELECT idShow AS id, c00 AS title, 'tvshow' AS entityType
       FROM tvshow
       WHERE INSTR(c00, ?) > 0
     ) AS searchResults
     ORDER BY title ASC, entityType ASC, id ASC
     LIMIT ? OFFSET ?`,
    [options.query, options.query, options.limit, options.offset],
  );

  return {
    items: rows.map(({ id, title, entityType }) => ({ id, title, entityType })),
    totalItems: Number(countRows[0]?.totalItems ?? 0),
  };
}
