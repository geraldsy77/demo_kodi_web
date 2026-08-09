import type { Pool, RowDataPacket } from 'mysql2/promise';

interface DatabaseNameRow extends RowDataPacket {
  databaseName: string;
}

export async function listVideoDatabaseCandidates(
  pool: Pool,
): Promise<string[]> {
  const [rows] = await pool.execute<DatabaseNameRow[]>(
    `SELECT SCHEMA_NAME AS databaseName
     FROM INFORMATION_SCHEMA.SCHEMATA
     WHERE SCHEMA_NAME LIKE ?
     ORDER BY SCHEMA_NAME`,
    ['MyVideos%'],
  );

  return rows.map((row) => row.databaseName);
}
