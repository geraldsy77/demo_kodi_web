import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { listVideoDatabaseCandidates } from './databaseDiscoveryRepository.js';

describe('listVideoDatabaseCandidates', () => {
  it('uses a parameterized metadata-only query and maps database names', async () => {
    const execute = vi.fn().mockResolvedValue([
      [{ databaseName: 'MyVideos121' }, { databaseName: 'MyVideos131' }],
      [],
    ]);
    const pool = { execute } as unknown as Pool;

    await expect(listVideoDatabaseCandidates(pool)).resolves.toEqual([
      'MyVideos121',
      'MyVideos131',
    ]);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('SCHEMA_NAME'), [
      'MyVideos%',
    ]);
  });
});
