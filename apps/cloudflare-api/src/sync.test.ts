import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const endpoint = 'https://example.test/api/internal/sync/snapshots';

function movie(id: number, title = `Movie ${id}`) {
  return {
    id,
    title,
    plot: null,
    premiered: null,
    userRating: null,
    rating: null,
    votes: null,
    playCount: null,
    lastPlayed: null,
    dateAdded: null,
    resumePositionSeconds: null,
    resumeTotalSeconds: null,
    artworkUrl: null,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: 'snapshot-1',
    version: 1,
    batchId: 'batch-1',
    action: 'upsert',
    movies: [movie(1)],
    tvShows: [],
    ...overrides,
  };
}

async function sync(body: unknown, headers: HeadersInit = {}) {
  const response = await SELF.fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-sync-token',
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sync_audit_log'),
    env.DB.prepare('DELETE FROM sync_rate_limits'),
    env.DB.prepare('DELETE FROM sync_snapshots'),
  ]);
});

describe('secure snapshot ingestion', () => {
  it('requires the configured bearer secret and a POST request', async () => {
    const missing = await SELF.fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload()),
    });
    const wrong = await sync(payload(), { authorization: 'Bearer wrong-token' });
    const method = await SELF.fetch(endpoint, { method: 'GET' });

    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(wrong.response.status).toBe(401);
    expect(wrong.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(method.status).toBe(405);
  });

  it('accepts a validated batch and records bounded audit metadata', async () => {
    const result = await sync(payload());
    const audit = await env.DB.prepare(`SELECT snapshot_id AS snapshotId,
      snapshot_version AS version, batch_id AS batchId, outcome, movie_count AS movieCount
      FROM sync_audit_log LIMIT 1`).first();

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({
      snapshotId: 'snapshot-1', version: 1, status: 'accepted', duplicate: false,
      movieCount: 1, tvShowCount: 0,
    });
    expect(audit).toEqual({
      snapshotId: 'snapshot-1', version: 1, batchId: 'batch-1',
      outcome: 'accepted', movieCount: 1,
    });
  });

  it('rejects invalid, oversized, and over-limit payloads with stable errors', async () => {
    const invalid = await sync(payload({ snapshotId: '../invalid' }));
    const overLimit = await sync(payload({
      movies: Array.from({ length: 51 }, (_, index) => movie(index + 1)),
    }));
    const oversized = await sync(`{"padding":"${'x'.repeat(1_048_576)}"}`);

    expect(invalid.response.status).toBe(400);
    expect(invalid.body).toMatchObject({ error: { code: 'INVALID_SYNC_PAYLOAD' } });
    expect(overLimit.response.status).toBe(400);
    expect(overLimit.body).toMatchObject({ error: { code: 'INVALID_SYNC_PAYLOAD' } });
    expect(oversized.response.status).toBe(413);
    expect(oversized.body).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
  });

  it('makes exact retries idempotent and rejects conflicting batch reuse', async () => {
    const first = await sync(payload());
    const retry = await sync(payload());
    const conflict = await sync(payload({ movies: [movie(2)] }));

    expect(first.body).toMatchObject({ duplicate: false });
    expect(retry.body).toMatchObject({ duplicate: true, movieCount: 1 });
    expect(conflict.response.status).toBe(409);
    expect(conflict.body).toMatchObject({ error: { code: 'BATCH_CONFLICT' } });
  });

  it('rejects stale snapshots and conflicting snapshot identifiers', async () => {
    await sync(payload({ snapshotId: 'older-existing', version: 1 }));
    await sync(payload({ snapshotId: 'newer', version: 2 }));
    const stale = await sync(payload({ snapshotId: 'older', version: 1 }));
    const staleExisting = await sync(payload({
      snapshotId: 'older-existing', version: 1, batchId: 'late-batch',
    }));
    const conflict = await sync(payload({ snapshotId: 'newer', version: 3, batchId: 'batch-2' }));

    expect(stale.response.status).toBe(409);
    expect(stale.body).toMatchObject({ error: { code: 'STALE_SNAPSHOT' } });
    expect(staleExisting.body).toMatchObject({ error: { code: 'STALE_SNAPSHOT' } });
    expect(conflict.response.status).toBe(409);
    expect(conflict.body).toMatchObject({ error: { code: 'SNAPSHOT_CONFLICT' } });
  });

  it('atomically activates a completed snapshot and removes omitted records', async () => {
    await sync(payload({ snapshotId: 'old', version: 1, movies: [movie(1), movie(2)] }));
    await sync(payload({ snapshotId: 'old', version: 1, batchId: 'complete-old', action: 'complete', movies: [] }));
    await sync(payload({ snapshotId: 'new', version: 2, batchId: 'new-data', movies: [movie(2, 'Updated')] }));
    const complete = await sync(payload({
      snapshotId: 'new', version: 2, batchId: 'complete-new', action: 'complete', movies: [],
    }));
    const completeRetry = await sync(payload({
      snapshotId: 'new', version: 2, batchId: 'complete-new', action: 'complete', movies: [],
    }));
    const movies = await SELF.fetch('https://example.test/api/movies');
    const oldSnapshot = await env.DB.prepare(
      "SELECT COUNT(id) AS total FROM sync_snapshots WHERE id = 'old'",
    ).first<{ total: number }>();

    expect(complete.body).toMatchObject({ status: 'completed', duplicate: false });
    expect(completeRetry.body).toMatchObject({ status: 'completed', duplicate: true });
    expect(await movies.json()).toMatchObject({
      items: [{ id: 2, title: 'Updated' }],
      pagination: { totalItems: 1 },
    });
    expect(oldSnapshot?.total).toBe(0);
  });

  it('rate limits authenticated requests and returns Retry-After', async () => {
    await sync(payload());
    for (let attempt = 1; attempt < 30; attempt += 1) {
      const retry = await sync(payload());
      expect(retry.response.status).toBe(200);
    }
    const limited = await sync(payload());

    expect(limited.response.status).toBe(429);
    expect(limited.response.headers.get('Retry-After')).toBe('60');
    expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it('sanitizes unexpected ingestion database failures', async () => {
    await env.DB.prepare('DROP TABLE sync_rate_limits').run();
    const result = await sync(payload());

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({
      error: {
        code: 'SYNC_DATABASE_ERROR',
        message: 'Unable to synchronize the library snapshot.',
      },
    });
    expect(JSON.stringify(result.body)).not.toContain('no such table');
  });
});
