import './config/loadEnvironment.js';

import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { createDatabasePool } from './db/pool.js';

const config = parseEnvironment(process.env);
const pool = createDatabasePool(config);
const app = createApp(pool, { webDistPath: config.WEB_DIST_PATH });

const server = app.listen(config.API_PORT, config.API_HOST, () => {
  console.log(`KODI Web listening on ${config.API_HOST}:${config.API_PORT}`);
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`KODI Web received ${signal}; shutting down.`);
  server.close((serverError) => {
    void pool.end()
      .catch(() => {
        process.exitCode = 1;
      })
      .finally(() => {
        if (serverError) process.exitCode = 1;
      });
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
