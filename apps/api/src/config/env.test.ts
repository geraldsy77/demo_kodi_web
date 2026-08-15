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
      API_HOST: '0.0.0.0',
      API_PORT: 3001,
      WEB_DIST_PATH: undefined,
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

  it('accepts native-hosting bind and web distribution settings', () => {
    expect(parseEnvironment({
      ...requiredEnvironment,
      API_HOST: '127.0.0.1',
      API_PORT: '8181',
      WEB_DIST_PATH: '/volume1/web/kodi-web/apps/web/dist',
    })).toMatchObject({
      API_HOST: '127.0.0.1',
      API_PORT: 8181,
      WEB_DIST_PATH: '/volume1/web/kodi-web/apps/web/dist',
    });
  });

  it('rejects missing database credentials', () => {
    expect(() => parseEnvironment({})).toThrow();
  });
});
