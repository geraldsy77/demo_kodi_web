import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { getTvShowById, getTvShowPage } from './tvShowRepository.js';

describe('getTvShowPage', () => {
  it('uses explicit verified columns, stable ordering, and pagination parameters', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: '26' }], []])
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            title: 'Example Show',
            premiered: '2025-01-01',
            rating: '7.5',
            totalEpisodes: '12',
            watchedEpisodes: '4',
            totalSeasons: '2',
            artworkUrl: 'https://images.example.test/show.jpg',
          },
        ],
        [],
      ]);

    await expect(
      getTvShowPage({ execute } as unknown as Pool, {
        limit: 24,
        offset: 24,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 7,
          title: 'Example Show',
          premiered: '2025-01-01',
          rating: 7.5,
          totalEpisodes: 12,
          watchedEpisodes: 4,
          totalSeasons: 2,
          artworkUrl: 'https://images.example.test/show.jpg',
        },
      ],
      totalItems: 26,
    });

    const listCall = execute.mock.calls[1];
    expect(listCall?.[0]).toContain(
      'ORDER BY dateAdded IS NULL ASC, dateAdded DESC, c00 ASC, idShow ASC',
    );
    expect(listCall?.[0]).not.toContain('SELECT *');
    expect(listCall?.[1]).toEqual([24, 24]);
  });
});

describe('getTvShowById', () => {
  it('uses a parameterized ID and maps verified TV-show metadata', async () => {
    const execute = vi.fn().mockResolvedValue([
      [
        {
          id: 7,
          title: 'Example Show',
          plot: 'Plot',
          premiered: '2025-01-01',
          userRating: 9,
          durationSeconds: '2700',
          rating: '7.5',
          votes: 100,
          lastPlayed: null,
          dateAdded: '2025-01-02 12:00:00',
          totalEpisodes: '12',
          watchedEpisodes: '4',
          totalSeasons: '2',
          artworkUrl: 'http://unsafe.example.test/show.jpg',
        },
      ],
      [],
    ]);

    await expect(
      getTvShowById({ execute } as unknown as Pool, 7),
    ).resolves.toEqual({
      id: 7,
      title: 'Example Show',
      plot: 'Plot',
      premiered: '2025-01-01',
      userRating: 9,
      durationSeconds: 2700,
      rating: 7.5,
      votes: 100,
      lastPlayed: null,
      dateAdded: '2025-01-02 12:00:00',
      totalEpisodes: 12,
      watchedEpisodes: 4,
      totalSeasons: 2,
      artworkUrl: null,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE idShow = ?'),
      [7],
    );
  });

  it('returns null for an unknown ID', async () => {
    const execute = vi.fn().mockResolvedValue([[], []]);

    await expect(
      getTvShowById({ execute } as unknown as Pool, 999),
    ).resolves.toBeNull();
  });
});
