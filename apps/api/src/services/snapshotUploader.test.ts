import { describe, expect, it, vi } from 'vitest';

import { createSnapshotUploader } from './snapshotUploader.js';

const payload = {
  snapshotId: 'snapshot-1', version: 1, batchId: 'batch-1', action: 'complete' as const,
  movies: [], tvShows: [],
};

describe('snapshot uploader', () => {
  it('retries retryable responses with bounded backoff and keeps the token in the header', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const uploader = createSnapshotUploader({
      endpoint: 'https://worker.example.test/sync', token: 'secret-token',
      maxRetries: 2, fetchImplementation: request, sleep,
    });

    await uploader.upload(payload);
    expect(request).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(request.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer secret-token',
    });
    expect(request.mock.calls[0]?.[1]?.body).not.toContain('secret-token');
  });

  it('does not retry permanent client errors', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    const uploader = createSnapshotUploader({
      endpoint: 'https://worker.example.test/sync', token: 'secret-token',
      maxRetries: 4, fetchImplementation: request,
    });
    await expect(uploader.upload(payload)).rejects.toThrow('rejected (400)');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('stops after the configured retry bound', async () => {
    const request = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const uploader = createSnapshotUploader({
      endpoint: 'https://worker.example.test/sync', token: 'secret-token',
      maxRetries: 2, fetchImplementation: request, sleep: vi.fn().mockResolvedValue(undefined),
    });
    await expect(uploader.upload(payload)).rejects.toThrow('bounded retries');
    expect(request).toHaveBeenCalledTimes(3);
  });
});
