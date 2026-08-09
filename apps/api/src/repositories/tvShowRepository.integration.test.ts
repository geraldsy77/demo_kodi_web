import '../config/loadEnvironment.js';

import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../db/pool.js';
import { getTvShowById, getTvShowPage } from './tvShowRepository.js';

const integrationEnabled = process.env.KODI_INTEGRATION_TEST === 'true';

describe.runIf(integrationEnabled)('getTvShowPage integration', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = createDatabasePool(parseEnvironment(process.env));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('returns deterministic, non-overlapping pages from the configured schema', async () => {
    if (!pool) throw new Error('Integration test pool was not initialized');

    const firstPage = await getTvShowPage(pool, { limit: 5, offset: 0 });
    const repeatedPage = await getTvShowPage(pool, { limit: 5, offset: 0 });
    const secondPage = await getTvShowPage(pool, { limit: 5, offset: 5 });

    expect(firstPage.items.length).toBeLessThanOrEqual(5);
    expect(firstPage.totalItems).toBeGreaterThanOrEqual(firstPage.items.length);
    expect(repeatedPage.items.map(({ id }) => id)).toEqual(
      firstPage.items.map(({ id }) => id),
    );
    const firstIds = new Set(firstPage.items.map(({ id }) => id));
    expect(secondPage.items.every(({ id }) => !firstIds.has(id))).toBe(true);
  });

  it('returns an existing TV show and null for an absent ID', async () => {
    if (!pool) throw new Error('Integration test pool was not initialized');

    const page = await getTvShowPage(pool, { limit: 1, offset: 0 });
    const firstTvShow = page.items[0];
    if (!firstTvShow) {
      throw new Error('Configured KODI library has no TV show to verify');
    }

    const detail = await getTvShowById(pool, firstTvShow.id);
    expect(detail?.id).toBe(firstTvShow.id);
    expect(detail?.title).toBe(firstTvShow.title);
    await expect(
      getTvShowById(pool, Number.MAX_SAFE_INTEGER),
    ).resolves.toBeNull();
  });
});
