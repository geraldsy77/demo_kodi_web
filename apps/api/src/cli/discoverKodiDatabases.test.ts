import type { Pool } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';

import { runDiscovery } from './discoverKodiDatabases.js';

const environment = {
  KODI_DB_HOST: 'mariadb.internal',
  KODI_DB_USER: 'readonly',
  KODI_DB_PASSWORD: 'highly-sensitive-password',
};

describe('runDiscovery', () => {
  it('prints candidates and closes the pool', async () => {
    const output = vi.fn();
    const end = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValue([
      [{ databaseName: 'MyVideos131' }],
      [],
    ]);

    const result = await runDiscovery({
      environment,
      output,
      poolFactory: () => ({ execute, end }) as unknown as Pool,
    });

    expect(result).toBe(0);
    expect(output).toHaveBeenCalledWith('- MyVideos131');
    expect(end).toHaveBeenCalledOnce();
  });

  it('returns a clear sanitized connection error', async () => {
    const outputError = vi.fn();
    const end = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockRejectedValue(new Error(environment.KODI_DB_PASSWORD));

    const result = await runDiscovery({
      environment,
      outputError,
      poolFactory: () => ({ execute, end }) as unknown as Pool,
    });

    expect(result).toBe(1);
    expect(outputError).toHaveBeenCalledOnce();
    expect(outputError.mock.calls.flat().join(' ')).not.toContain(
      environment.KODI_DB_PASSWORD,
    );
    expect(end).toHaveBeenCalledOnce();
  });

  it('reports when no candidates are visible', async () => {
    const output = vi.fn();
    const end = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn().mockResolvedValue([[], []]);

    const result = await runDiscovery({
      environment,
      output,
      poolFactory: () => ({ execute, end }) as unknown as Pool,
    });

    expect(result).toBe(0);
    expect(output).toHaveBeenCalledWith(
      'No MyVideos% database candidates were found.',
    );
  });
});
