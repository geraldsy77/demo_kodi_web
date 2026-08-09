import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { getSnapshotMoviePage, getSnapshotTvShowPage } from './snapshotExportRepository.js';

describe('snapshot export repository', () => {
  it('exports the complete movie read-model DTO with SELECT-only paged SQL', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ totalItems: '1' }], []])
      .mockResolvedValueOnce([[
        {
          id: 7, title: 'Movie', plot: 'Plot', premiered: null, userRating: 9,
          rating: '7.5', votes: 10, playCount: 1, lastPlayed: null, dateAdded: null,
          resumePositionSeconds: '12', resumeTotalSeconds: '100',
          artworkUrl: 'image://private/path',
        },
      ], []]);

    const result = await getSnapshotMoviePage({ execute } as unknown as Pool, 50, 100);
    expect(result).toEqual({
      totalItems: 1,
      items: [{
        id: 7, title: 'Movie', plot: 'Plot', premiered: null, userRating: 9,
        rating: 7.5, votes: 10, playCount: 1, lastPlayed: null, dateAdded: null,
        resumePositionSeconds: 12, resumeTotalSeconds: 100, artworkUrl: null,
      }],
    });
    const sql = String(execute.mock.calls[1]?.[0]);
    expect(sql).toContain('FROM movie_view');
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).not.toMatch(/strPath|strFileName|uniqueid/i);
    expect(sql).not.toMatch(/INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE/i);
    expect(execute.mock.calls[1]?.[1]).toEqual([50, 100]);
  });

  it('exports the complete TV read-model DTO without raw paths', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ totalItems: 1 }], []])
      .mockResolvedValueOnce([[
        {
          id: 8, title: 'Show', plot: null, premiered: '2020-01-01', userRating: 8,
          durationSeconds: '2700', rating: '8.2', votes: 20, lastPlayed: null,
          dateAdded: null, totalEpisodes: '10', watchedEpisodes: '5',
          totalSeasons: '2', artworkUrl: 'https://images.example.test/show.jpg',
        },
      ], []]);

    const result = await getSnapshotTvShowPage({ execute } as unknown as Pool, 25, 0);
    expect(result.items[0]).toMatchObject({
      durationSeconds: 2700, rating: 8.2, totalEpisodes: 10,
      watchedEpisodes: 5, totalSeasons: 2,
      artworkUrl: 'https://images.example.test/show.jpg',
    });
    const sql = String(execute.mock.calls[1]?.[0]);
    expect(sql).not.toMatch(/strPath|uniqueid|SELECT\s+\*/i);
    expect(sql).not.toMatch(/INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE/i);
  });
});
