import './config/loadEnvironment.js';

import { createApp } from './app.js';
import { parseEnvironment } from './config/env.js';
import { createDatabasePool } from './db/pool.js';

const config = parseEnvironment(process.env);
const pool = createDatabasePool(config);
const app = createApp(pool);

app.listen(config.API_PORT, () => {
  console.log(`KODI API listening on port ${config.API_PORT}`);
});
