import { pathToFileURL } from 'node:url';

import type { Pool } from 'mysql2/promise';

import '../config/loadEnvironment.js';
import { parseEnvironment, type ApiConfig } from '../config/env.js';
import { createDatabasePool } from '../db/pool.js';
import { listVideoDatabaseCandidates } from '../repositories/databaseDiscoveryRepository.js';

type Output = (message: string) => void;

interface DiscoveryDependencies {
  environment?: NodeJS.ProcessEnv;
  output?: Output;
  outputError?: Output;
  poolFactory?: (config: ApiConfig) => Pool;
}

export async function runDiscovery(
  dependencies: DiscoveryDependencies = {},
): Promise<number> {
  const output = dependencies.output ?? console.log;
  const outputError = dependencies.outputError ?? console.error;
  let pool: Pool | undefined;

  try {
    const config = parseEnvironment(dependencies.environment ?? process.env);
    pool = (dependencies.poolFactory ?? createDatabasePool)(config);
    const candidates = await listVideoDatabaseCandidates(pool);

    if (candidates.length === 0) {
      output('No MyVideos% database candidates were found.');
    } else {
      output('KODI video database candidates:');
      for (const candidate of candidates) {
        output(`- ${candidate}`);
      }
    }

    return 0;
  } catch {
    outputError(
      'Unable to discover KODI databases. Verify the MariaDB host, port, read-only credentials, and network access.',
    );
    return 1;
  } finally {
    await pool?.end().catch(() => undefined);
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  process.exitCode = await runDiscovery();
}
