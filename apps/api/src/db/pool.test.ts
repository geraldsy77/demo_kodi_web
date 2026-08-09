import { describe, expect, it } from 'vitest';

import { createPoolOptions } from './pool.js';

describe('createPoolOptions', () => {
  it('uses conservative limits and validated connection settings', () => {
    const options = createPoolOptions({
      KODI_DB_HOST: 'mariadb.internal',
      KODI_DB_PORT: 3307,
      KODI_DB_USER: 'readonly',
      KODI_DB_PASSWORD: 'secret',
      KODI_VIDEO_DB: undefined,
    });

    expect(options).toMatchObject({
      host: 'mariadb.internal',
      port: 3307,
      user: 'readonly',
      password: 'secret',
      connectionLimit: 4,
      waitForConnections: true,
      queueLimit: 8,
      connectTimeout: 5_000,
    });
  });
});
