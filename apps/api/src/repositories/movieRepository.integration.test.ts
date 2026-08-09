import '../config/loadEnvironment.js';

import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../db/pool.js';
import { getMovieById, getMoviePage } from './movieRepository.js';

const integrationEnabled = process.env.KODI_INTEGRATION_TEST === 'true';

describe.runIf(integrationEnabled)('getMoviePage integration', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = createDatabasePool(parseEnvironment(process.env));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('returns a limited, stably ordered page from the configured schema', async () => {
    if (!pool) {
      throw new Error('Integration test pool was not initialized');
    }

    const result = await getMoviePage(pool, { limit: 5, offset: 0 });

    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.totalItems).toBeGreaterThanOrEqual(result.items.length);
    for (let index = 1; index < result.items.length; index += 1) {
      const previous = result.items[index - 1];
      const current = result.items[index];
      if (!previous || !current) continue;

      expect(
        previous.title.localeCompare(current.title) < 0 ||
          (previous.title.localeCompare(current.title) === 0 &&
            previous.id < current.id),
      ).toBe(true);
    }
  });

  it('returns an existing movie and null for an absent ID', async () => {
    if (!pool) {
      throw new Error('Integration test pool was not initialized');
    }

    const page = await getMoviePage(pool, { limit: 1, offset: 0 });
    const firstMovie = page.items[0];
    if (!firstMovie) {
      throw new Error('Configured KODI library has no movie to verify');
    }

    const detail = await getMovieById(pool, firstMovie.id);
    expect(detail?.id).toBe(firstMovie.id);
    expect(detail?.title).toBe(firstMovie.title);
    await expect(
      getMovieById(pool, Number.MAX_SAFE_INTEGER),
    ).resolves.toBeNull();
  });
});
