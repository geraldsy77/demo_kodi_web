import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';

import type { ApiConfig } from '../config/env.js';

type DatabaseConfig = Pick<
  ApiConfig,
  | 'KODI_DB_HOST'
  | 'KODI_DB_PORT'
  | 'KODI_DB_USER'
  | 'KODI_DB_PASSWORD'
  | 'KODI_VIDEO_DB'
>;

export function createPoolOptions(config: DatabaseConfig): PoolOptions {
  return {
    host: config.KODI_DB_HOST,
    port: config.KODI_DB_PORT,
    user: config.KODI_DB_USER,
    password: config.KODI_DB_PASSWORD,
    database: config.KODI_VIDEO_DB,
    connectionLimit: 4,
    waitForConnections: true,
    queueLimit: 8,
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

export function createDatabasePool(config: DatabaseConfig): Pool {
  return createPool(createPoolOptions(config));
}
