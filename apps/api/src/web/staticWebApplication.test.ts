import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

describe('native static web hosting', () => {
  let webDistPath: string;

  beforeEach(async () => {
    webDistPath = await mkdtemp(path.join(tmpdir(), 'kodi-web-static-'));
    await mkdir(path.join(webDistPath, 'assets'));
    await writeFile(
      path.join(webDistPath, 'index.html'),
      '<!doctype html><html><body>NAS application shell</body></html>',
    );
    await writeFile(path.join(webDistPath, 'assets', 'app.js'), 'export {};');
  });

  afterEach(async () => {
    await rm(webDistPath, { force: true, recursive: true });
  });

  it('serves the application shell and static assets', async () => {
    const app = createApp({} as Pool, { webDistPath });

    const home = await request(app).get('/').set('Accept', 'text/html');
    const asset = await request(app).get('/assets/app.js');

    expect(home.status).toBe(200);
    expect(home.text).toContain('NAS application shell');
    expect(asset.status).toBe(200);
    expect(asset.text).toBe('export {};');
  });

  it('uses the application shell for React deep links', async () => {
    const response = await request(createApp({} as Pool, { webDistPath }))
      .get('/movies/7')
      .set('Accept', 'text/html');

    expect(response.status).toBe(200);
    expect(response.text).toContain('NAS application shell');
  });

  it('does not replace missing API responses with the application shell', async () => {
    const response = await request(createApp({} as Pool, { webDistPath }))
      .get('/api/missing')
      .set('Accept', 'text/html');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('NAS application shell');
  });

  it('rejects a web directory without a compiled application shell', () => {
    expect(() => createApp({} as Pool, {
      webDistPath: path.join(webDistPath, 'missing'),
    })).toThrow('WEB_DIST_PATH must contain a compiled index.html file.');
  });
});
