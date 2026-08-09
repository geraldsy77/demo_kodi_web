import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

async function json(path: string, init?: RequestInit) {
  const response = await SELF.fetch(`https://example.test${path}`, init);
  return { response, body: await response.json() };
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM sync_snapshots').run();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sync_snapshots
      (id, created_at, completed_at, is_active)
      VALUES ('snapshot-1', '2026-08-09T00:00:00Z', '2026-08-09T00:01:00Z', 1)`),
    env.DB.prepare(`INSERT INTO movies (
      snapshot_id, id, title, search_title, plot, premiered, user_rating,
      rating, votes, play_count, last_played, date_added,
      resume_position_seconds, resume_total_seconds, artwork_url
    ) VALUES (
      'snapshot-1', 7, 'Example Movie', 'example movie', 'A plot', '2025-01-01',
      9, 7.5, 1200, 1, NULL, '2025-01-02 12:00:00', 1800, 7200,
      'https://images.example.test/movie.jpg'
    )`),
    env.DB.prepare(`INSERT INTO movies (
      snapshot_id, id, title, search_title, premiered, rating, play_count
    ) VALUES ('snapshot-1', 8, 'Another Movie', 'another movie', NULL, NULL, NULL)`),
    env.DB.prepare(`INSERT INTO tv_shows (
      snapshot_id, id, title, search_title, plot, premiered, user_rating,
      duration_seconds, rating, votes, last_played, date_added,
      total_episodes, watched_episodes, total_seasons, artwork_url
    ) VALUES (
      'snapshot-1', 12, 'Example Show', 'example show', 'Show plot', '2020-01-01',
      8, 2700, 8.2, 400, NULL, '2020-01-02 12:00:00', 20, 5, 2,
      'https://images.example.test/show.jpg'
    )`),
  ]);
});

describe('Cloudflare D1 read API', () => {
  it('returns the stable health and summary contracts', async () => {
    const health = await json('/api/health');
    const summary = await json('/api/library/summary');

    expect(health.response.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(summary.body).toEqual({ movieCount: 2, tvShowCount: 1 });
  });

  it('returns an empty library when no completed snapshot is active', async () => {
    await env.DB.prepare('DELETE FROM sync_snapshots').run();

    const summary = await json('/api/library/summary');
    const movies = await json('/api/movies');

    expect(summary.body).toEqual({ movieCount: 0, tvShowCount: 0 });
    expect(movies.body).toEqual({
      items: [],
      pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    });
  });

  it('paginates movies using deterministic title ordering', async () => {
    const { response, body } = await json('/api/movies?page=2&pageSize=1');

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [{
        id: 7,
        title: 'Example Movie',
        premiered: '2025-01-01',
        rating: 7.5,
        playCount: 1,
        artworkUrl: 'https://images.example.test/movie.jpg',
      }],
      pagination: { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 },
    });
  });

  it('returns movie detail with resume metadata', async () => {
    const { response, body } = await json('/api/movies/7');

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: 7,
      title: 'Example Movie',
      plot: 'A plot',
      premiered: '2025-01-01',
      userRating: 9,
      rating: 7.5,
      votes: 1200,
      playCount: 1,
      lastPlayed: null,
      dateAdded: '2025-01-02 12:00:00',
      artworkUrl: 'https://images.example.test/movie.jpg',
      resume: { positionSeconds: 1800, totalSeconds: 7200 },
    });
  });

  it('returns TV-show browse and detail contracts', async () => {
    const list = await json('/api/tvshows');
    const detail = await json('/api/tvshows/12');

    expect(list.body).toEqual({
      items: [{
        id: 12,
        title: 'Example Show',
        premiered: '2020-01-01',
        rating: 8.2,
        totalEpisodes: 20,
        watchedEpisodes: 5,
        totalSeasons: 2,
        artworkUrl: 'https://images.example.test/show.jpg',
      }],
      pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
    });
    expect(detail.body).toEqual({
      id: 12,
      title: 'Example Show',
      plot: 'Show plot',
      premiered: '2020-01-01',
      userRating: 8,
      durationSeconds: 2700,
      rating: 8.2,
      votes: 400,
      lastPlayed: null,
      dateAdded: '2020-01-02 12:00:00',
      totalEpisodes: 20,
      watchedEpisodes: 5,
      totalSeasons: 2,
      artworkUrl: 'https://images.example.test/show.jpg',
    });
  });

  it('searches both entity types with stable pagination', async () => {
    const { body } = await json('/api/search?q=example&page=1&pageSize=10');

    expect(body).toEqual({
      items: [
        { id: 7, title: 'Example Movie', entityType: 'movie' },
        { id: 12, title: 'Example Show', entityType: 'tvshow' },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
    });
  });

  it.each([
    ['/api/movies/999', 404, 'MOVIE_NOT_FOUND'],
    ['/api/tvshows/999', 404, 'TV_SHOW_NOT_FOUND'],
    ['/api/movies/0', 400, 'INVALID_ID'],
    ['/api/tvshows/nope', 400, 'INVALID_ID'],
  ])('returns stable detail errors for %s', async (path, status, code) => {
    const result = await json(path);
    expect(result.response.status).toBe(status);
    expect(result.body).toMatchObject({ error: { code } });
  });

  it.each([
    '/api/movies?page=0',
    '/api/movies?pageSize=101',
    '/api/tvshows?page=1.5',
    '/api/movies?page=1&page=2',
  ])('rejects invalid pagination for %s', async (path) => {
    const result = await json(path);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({
      error: { code: 'INVALID_QUERY', message: 'Invalid pagination parameters.' },
    });
  });

  it.each(['/api/search', '/api/search?q=%20', `/api/search?q=${'x'.repeat(101)}`])(
    'rejects invalid search for %s',
    async (path) => {
      const result = await json(path);
      expect(result.response.status).toBe(400);
      expect(result.body).toEqual({
        error: { code: 'INVALID_QUERY', message: 'Invalid search parameters.' },
      });
    },
  );

  it('returns JSON 404 and 405 responses', async () => {
    const missing = await json('/api/missing');
    const method = await json('/api/movies', { method: 'POST' });
    expect(missing.response.status).toBe(404);
    expect(missing.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(method.response.status).toBe(405);
    expect(method.body).toMatchObject({ error: { code: 'METHOD_NOT_ALLOWED' } });
  });

  it('sanitizes unexpected D1 failures', async () => {
    await env.DB.prepare('DROP TABLE movies').run();

    const { response, body } = await json('/api/movies');

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unable to read the KODI library.',
      },
    });
    expect(JSON.stringify(body)).not.toContain('no such table');
  });
});
