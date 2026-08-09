import { beforeEach, describe, expect, it, vi } from 'vitest';

import { probeQuery, runProbe } from './index';

const binding = {
  host: 'hyperdrive.test',
  user: 'readonly',
  password: 'not-a-real-secret',
  database: 'MyVideos121',
  port: 3306,
};
const env = { HYPERDRIVE: binding };

describe('Hyperdrive feasibility probe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs only the bounded read-only query and reports latency', async () => {
    const query = vi.fn().mockResolvedValue([[{ ok: 1 }], []]);
    const end = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn().mockResolvedValue({ query, end });
    const times = [1_000, 1_024];

    const response = await runProbe(
      env,
      () => times.shift() ?? 1_024,
      connect as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', latencyMs: 24 });
    expect(query).toHaveBeenCalledExactlyOnceWith(probeQuery);
    expect(end).toHaveBeenCalledOnce();
  });

  it('returns a stable failure without leaking connection details', async () => {
    const connect = vi.fn().mockRejectedValue(
      new Error('password for private.internal:3306 was rejected'),
    );
    const times = [2_000, 7_000];

    const response = await runProbe(
      env,
      () => times.shift() ?? 7_000,
      connect as never,
    );
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('DATABASE_UNAVAILABLE');
    expect(body).toContain('"latencyMs":5000');
    expect(body).not.toContain('private.internal');
    expect(body).not.toContain('password');
  });
});
