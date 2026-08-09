import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

describe('parseEnvironment', () => {
  const requiredEnvironment = {
    KODI_DB_HOST: 'mariadb.internal',
    KODI_DB_USER: 'kodi_web_readonly',
    KODI_DB_PASSWORD: 'test-password',
  };

  it('validates database settings and uses safe defaults', () => {
    expect(parseEnvironment(requiredEnvironment)).toEqual({
      NODE_ENV: 'development',
      API_PORT: 3001,
      KODI_DB_HOST: 'mariadb.internal',
      KODI_DB_PORT: 3306,
      KODI_DB_USER: 'kodi_web_readonly',
      KODI_DB_PASSWORD: 'test-password',
      KODI_VIDEO_DB: undefined,
    });
  });

  it('rejects an invalid API port', () => {
    expect(() =>
      parseEnvironment({ ...requiredEnvironment, API_PORT: 'not-a-port' }),
    ).toThrow();
  });

  it('rejects missing database credentials', () => {
    expect(() => parseEnvironment({})).toThrow();
  });
});
