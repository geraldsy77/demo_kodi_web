import '../config/loadEnvironment.js';

import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../db/pool.js';
import { getMoviePage } from './movieRepository.js';
import { searchLibrary } from './searchRepository.js';

const integrationEnabled = process.env.KODI_INTEGRATION_TEST === 'true';

describe.runIf(integrationEnabled)('searchLibrary integration', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = createDatabasePool(parseEnvironment(process.env));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('finds a known title and returns deterministic typed results', async () => {
    if (!pool) throw new Error('Integration test pool was not initialized');

    const moviePage = await getMoviePage(pool, { limit: 1, offset: 0 });
    const knownMovie = moviePage.items[0];
    if (!knownMovie) throw new Error('Configured KODI library has no movie');

    const first = await searchLibrary(pool, {
      query: knownMovie.title,
      limit: 10,
      offset: 0,
    });
    const repeated = await searchLibrary(pool, {
      query: knownMovie.title,
      limit: 10,
      offset: 0,
    });

    expect(first.items).toContainEqual({
      id: knownMovie.id,
      title: knownMovie.title,
      entityType: 'movie',
    });
    expect(first.items.length).toBeLessThanOrEqual(10);
    expect(first.totalItems).toBeGreaterThanOrEqual(first.items.length);
    expect(repeated.items).toEqual(first.items);
    expect(first.items.every(({ entityType }) =>
      entityType === 'movie' || entityType === 'tvshow',
    )).toBe(true);
  });
});
