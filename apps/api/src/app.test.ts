import request from 'supertest';
import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns a successful JSON health response', async () => {
    const response = await request(createApp({} as Pool)).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/library/summary', () => {
  it('returns movie and TV-show counts as JSON', async () => {
    const execute = vi.fn().mockResolvedValue([
      [{ movieCount: 38, tvShowCount: 26 }],
      [],
    ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/library/summary');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ movieCount: 38, tvShowCount: 26 });
  });

  it('returns a stable error without leaking database details', async () => {
    const rawError = 'SELECT secret FROM mysql.user failed at 192.168.0.3';
    const execute = vi.fn().mockRejectedValue(new Error(rawError));
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/library/summary');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(rawError);
  });
});

describe('GET /api/movies', () => {
  it('returns a valid paginated movie response', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: 3 }], []])
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            title: 'A Movie',
            premiered: '2024-01-01',
            rating: 8,
            playCount: 1,
            artworkUrl: 'https://images.example.test/movie.jpg',
          },
        ],
        [],
      ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/movies?page=2&pageSize=1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          id: 11,
          title: 'A Movie',
          premiered: '2024-01-01',
          rating: 8,
          playCount: 1,
          artworkUrl: 'https://images.example.test/movie.jpg',
        },
      ],
      pagination: {
        page: 2,
        pageSize: 1,
        totalItems: 3,
        totalPages: 3,
      },
    });
    expect(execute.mock.calls[1]?.[1]).toEqual([1, 1]);
  });

  it.each([
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=invalid',
    '?pageSize=0',
    '?pageSize=101',
  ])('rejects invalid pagination: %s', async (query) => {
    const execute = vi.fn();
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get(`/api/movies${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_QUERY',
        message: 'Invalid pagination parameters.',
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('GET /api/movies/:id', () => {
  it('returns verified movie detail metadata', async () => {
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
          lastPlayed: null,
          dateAdded: '2025-01-02 12:00:00',
          resumeTimeInSeconds: null,
          totalTimeInSeconds: null,
          artworkUrl: null,
        },
      ],
      [],
    ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/movies/7');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 7,
      title: 'Example',
      plot: 'Plot',
      premiered: '2025-01-01',
      userRating: 9,
      rating: 7.5,
      votes: 100,
      playCount: 1,
      lastPlayed: null,
      dateAdded: '2025-01-02 12:00:00',
      resume: null,
      artworkUrl: null,
    });
    expect(execute).toHaveBeenCalledWith(expect.any(String), [7]);
  });

  it('returns 404 for an unknown movie', async () => {
    const execute = vi.fn().mockResolvedValue([[], []]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/movies/999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'MOVIE_NOT_FOUND', message: 'Movie not found.' },
    });
  });

  it.each(['/api/movies/0', '/api/movies/-1', '/api/movies/1.5', '/api/movies/abc'])(
    'rejects invalid ID before repository access: %s',
    async (path) => {
      const execute = vi.fn();
      const response = await request(
        createApp({ execute } as unknown as Pool),
      ).get(path);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: { code: 'INVALID_ID', message: 'Invalid movie ID.' },
      });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('does not expose repository errors', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error('SELECT c00 FROM movie_view failed'));
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/movies/7');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
  });
});

describe('GET /api/tvshows', () => {
  it('returns a valid paginated TV-show response', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: 3 }], []])
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            title: 'A Show',
            premiered: '2024-01-01',
            rating: 8,
            totalEpisodes: 12,
            watchedEpisodes: 4,
            totalSeasons: 2,
            artworkUrl: 'https://images.example.test/show.jpg',
          },
        ],
        [],
      ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/tvshows?page=2&pageSize=1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          id: 11,
          title: 'A Show',
          premiered: '2024-01-01',
          rating: 8,
          totalEpisodes: 12,
          watchedEpisodes: 4,
          totalSeasons: 2,
          artworkUrl: 'https://images.example.test/show.jpg',
        },
      ],
      pagination: {
        page: 2,
        pageSize: 1,
        totalItems: 3,
        totalPages: 3,
      },
    });
    expect(execute.mock.calls[1]?.[1]).toEqual([1, 1]);
  });

  it.each([
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=invalid',
    '?pageSize=0',
    '?pageSize=101',
  ])('rejects invalid pagination before repository access: %s', async (query) => {
    const execute = vi.fn();
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get(`/api/tvshows${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_QUERY',
        message: 'Invalid pagination parameters.',
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not expose repository errors', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error('SELECT c00 FROM tvshow_view failed'));
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/tvshows');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
  });
});

describe('GET /api/tvshows/:id', () => {
  it('returns verified TV-show detail metadata', async () => {
    const execute = vi.fn().mockResolvedValue([
      [
        {
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
        },
      ],
      [],
    ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/tvshows/7');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
    expect(execute).toHaveBeenCalledWith(expect.any(String), [7]);
  });

  it('returns 404 for an unknown TV show', async () => {
    const execute = vi.fn().mockResolvedValue([[], []]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/tvshows/999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'TV_SHOW_NOT_FOUND', message: 'TV show not found.' },
    });
  });

  it.each([
    '/api/tvshows/0',
    '/api/tvshows/-1',
    '/api/tvshows/1.5',
    '/api/tvshows/abc',
  ])('rejects invalid ID before repository access: %s', async (path) => {
    const execute = vi.fn();
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get(path);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'INVALID_ID', message: 'Invalid TV show ID.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not expose repository errors', async () => {
    const execute = vi
      .fn()
      .mockRejectedValue(new Error('SELECT c00 FROM tvshow_view failed'));
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/tvshows/7');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
  });
});

describe('GET /api/search', () => {
  it('returns paginated results that distinguish entity type', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: 3 }], []])
      .mockResolvedValueOnce([
        [
          { id: 4, title: 'Example Movie', entityType: 'movie' },
          { id: 9, title: 'Example Show', entityType: 'tvshow' },
        ],
        [],
      ]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/search?q=%20Example%20&page=2&pageSize=2');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        { id: 4, title: 'Example Movie', entityType: 'movie' },
        { id: 9, title: 'Example Show', entityType: 'tvshow' },
      ],
      pagination: {
        page: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
      },
    });
    expect(execute.mock.calls[1]?.[1]).toEqual(['Example', 'Example', 2, 2]);
  });

  it.each([
    '',
    '?q=',
    '?q=%20%20',
    `?q=${'a'.repeat(101)}`,
    '?q=valid&page=0',
    '?q=valid&pageSize=101',
  ])('rejects invalid search parameters before repository access: %s', async (query) => {
    const execute = vi.fn();
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get(`/api/search${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'INVALID_QUERY', message: 'Invalid search parameters.' },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns an empty paginated response when there are no matches', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([[{ totalItems: 0 }], []])
      .mockResolvedValueOnce([[], []]);
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/search?q=missing');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 24,
        totalItems: 0,
        totalPages: 0,
      },
    });
  });

  it('does not expose repository errors', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('private SQL failed'));
    const response = await request(
      createApp({ execute } as unknown as Pool),
    ).get('/api/search?q=Example');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
  });
});
