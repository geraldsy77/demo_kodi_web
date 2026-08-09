import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { getMovieById, getMoviePage } from './movieRepository.js';

describe('getMoviePage', () => {
  it('uses explicit columns, stable ordering, and parameterized pagination', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: '38' }], []])
      .mockResolvedValueOnce([
        [
          {
            id: 7,
            title: 'Example',
            premiered: '2025-01-01',
            rating: 7.5,
            playCount: null,
            artworkUrl: 'https://images.example.test/poster.jpg',
          },
        ],
        [],
      ]);

    await expect(
      getMoviePage({ execute } as unknown as Pool, { limit: 24, offset: 24 }),
    ).resolves.toEqual({
      items: [
        {
          id: 7,
          title: 'Example',
          premiered: '2025-01-01',
          rating: 7.5,
          playCount: null,
          artworkUrl: 'https://images.example.test/poster.jpg',
        },
      ],
      totalItems: 38,
    });

    const listCall = execute.mock.calls[1];
    expect(listCall?.[0]).toContain('ORDER BY c00 ASC, idMovie ASC');
    expect(listCall?.[0]).not.toContain('SELECT *');
    expect(listCall?.[1]).toEqual([24, 24]);
  });
});

describe('getMovieById', () => {
  it('uses a parameterized ID and maps verified movie metadata', async () => {
    const execute = vi.fn().mockResolvedValue([
      [
        {
          id: 7,
          title: 'Example',
          plot: 'Plot',
          premiered: '2025-01-01',
          userRating: 9,
          rating: 7.5,
          votes: 100,
          playCount: 1,
          lastPlayed: '2026-01-01 12:00:00',
          dateAdded: '2025-01-02 12:00:00',
          resumeTimeInSeconds: 120,
          totalTimeInSeconds: 7200,
          artworkUrl: 'image://unsupported/',
        },
      ],
      [],
    ]);

    await expect(
      getMovieById({ execute } as unknown as Pool, 7),
    ).resolves.toEqual({
      id: 7,
      title: 'Example',
      plot: 'Plot',
      premiered: '2025-01-01',
      userRating: 9,
      rating: 7.5,
      votes: 100,
      playCount: 1,
      lastPlayed: '2026-01-01 12:00:00',
      dateAdded: '2025-01-02 12:00:00',
      resume: { positionSeconds: 120, totalSeconds: 7200 },
      artworkUrl: null,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE idMovie = ?'),
      [7],
    );
  });

  it('returns null for an unknown ID', async () => {
    const execute = vi.fn().mockResolvedValue([[], []]);

    await expect(
      getMovieById({ execute } as unknown as Pool, 999),
    ).resolves.toBeNull();
  });
});
