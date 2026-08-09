import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { getLibrarySummary } from './librarySummaryRepository.js';

describe('getLibrarySummary', () => {
  it('maps database counts to a stable numeric DTO', async () => {
    const execute = vi.fn().mockResolvedValue([
      [{ movieCount: '38', tvShowCount: 26 }],
      [],
    ]);

    await expect(
      getLibrarySummary({ execute } as unknown as Pool),
    ).resolves.toEqual({
      movieCount: 38,
      tvShowCount: 26,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('COUNT(idMovie)'),
    );
  });

  it('rejects an empty database result', async () => {
    const execute = vi.fn().mockResolvedValue([[], []]);

    await expect(
      getLibrarySummary({ execute } as unknown as Pool),
    ).rejects.toThrow('Library summary query returned no result');
  });
});
