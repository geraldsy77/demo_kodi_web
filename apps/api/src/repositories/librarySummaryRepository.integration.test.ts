import '../config/loadEnvironment.js';

import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnvironment } from '../config/env.js';
import { createDatabasePool } from '../db/pool.js';
import { getLibrarySummary } from './librarySummaryRepository.js';

const integrationEnabled = process.env.KODI_INTEGRATION_TEST === 'true';

describe.runIf(integrationEnabled)('getLibrarySummary integration', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = createDatabasePool(parseEnvironment(process.env));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('reads non-negative counts from the configured KODI schema', async () => {
    if (!pool) {
      throw new Error('Integration test pool was not initialized');
    }

    const summary = await getLibrarySummary(pool);

    expect(summary.movieCount).toBeGreaterThanOrEqual(0);
    expect(summary.tvShowCount).toBeGreaterThanOrEqual(0);
  });
});
