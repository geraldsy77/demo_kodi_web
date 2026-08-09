import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { searchLibrary } from './searchRepository.js';

describe('searchLibrary', () => {
  it('uses parameterized search and pagination with typed results', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: '3' }], []])
      .mockResolvedValueOnce([
        [
          { id: 4, title: 'Example Movie', entityType: 'movie' },
          { id: 9, title: 'Example Show', entityType: 'tvshow' },
        ],
        [],
      ]);

    await expect(
      searchLibrary({ execute } as unknown as Pool, {
        query: 'Example',
        limit: 2,
        offset: 2,
      }),
    ).resolves.toEqual({
      items: [
        { id: 4, title: 'Example Movie', entityType: 'movie' },
        { id: 9, title: 'Example Show', entityType: 'tvshow' },
      ],
      totalItems: 3,
    });

    expect(execute.mock.calls[0]?.[1]).toEqual(['Example', 'Example']);
    expect(execute.mock.calls[1]?.[1]).toEqual(['Example', 'Example', 2, 2]);
    expect(execute.mock.calls[1]?.[0]).toContain(
      'ORDER BY title ASC, entityType ASC, id ASC',
    );
    expect(execute.mock.calls[1]?.[0]).not.toContain('SELECT *');
  });
});
