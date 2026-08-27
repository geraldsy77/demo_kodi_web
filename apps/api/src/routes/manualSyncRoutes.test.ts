import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { errorHandler } from '../middleware/errorHandler.js';
import type { ManualSyncRun } from '../services/manualSyncRunStore.js';
import {
  SyncAlreadyRunningError,
  SyncRunNotFoundError,
  type ManualSyncTriggerService,
} from '../services/manualSyncTriggerService.js';
import { createManualSyncRouter } from './manualSyncRoutes.js';

const triggerToken = 'trigger-token-that-is-at-least-32-characters';
const runId = 'b190c6b2-9a31-4ff4-b65c-43ebf27f9851';
const running: ManualSyncRun = {
  runId,
  status: 'running',
  startedAt: '2026-08-27T12:00:00.000Z',
  completedAt: null,
  movieCount: null,
  tvShowCount: null,
  failureCode: null,
};

function createService(
  overrides: Partial<ManualSyncTriggerService> = {},
): ManualSyncTriggerService {
  return {
    start: vi.fn().mockResolvedValue(running),
    get: vi.fn().mockResolvedValue(running),
    ...overrides,
  };
}

function createTestApp(service: ManualSyncTriggerService): Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/internal/sync',
    createManualSyncRouter(service, triggerToken),
  );
  app.use(errorHandler);
  return app;
}

function authorized(target: request.Test): request.Test {
  return target.set('Authorization', `Bearer ${triggerToken}`);
}

describe('manual synchronization routes', () => {
  it('does not mount the route when the native trigger is disabled', async () => {
    const response = await request(createApp({} as Pool))
      .post('/api/internal/sync/runs');

    expect(response.status).toBe(404);
  });

  it.each([
    undefined,
    'Basic credentials',
    'Bearer wrong-length',
    `Bearer ${'x'.repeat(triggerToken.length)}`,
  ])('rejects missing or invalid authentication', async (authorization) => {
    const service = createService();
    let target = request(createTestApp(service)).post(
      '/api/internal/sync/runs',
    );

    if (authorization) target = target.set('Authorization', authorization);

    const response = await target;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'SYNC_TRIGGER_UNAUTHORIZED',
        message: 'Valid synchronization credentials are required.',
      },
    });
    expect(service.start).not.toHaveBeenCalled();
  });

  it('accepts an empty request and returns the polling URL', async () => {
    const service = createService();
    const response = await authorized(
      request(createTestApp(service)).post('/api/internal/sync/runs'),
    ).send({});

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      runId,
      state: 'running',
      startedAt: running.startedAt,
      statusUrl: `/api/internal/sync/runs/${runId}`,
    });
    expect(service.start).toHaveBeenCalledOnce();
  });

  it('rejects request properties before starting a process', async () => {
    const service = createService();
    const unsafeValue = '/bin/untrusted-command';
    const response = await authorized(
      request(createTestApp(service)).post('/api/internal/sync/runs'),
    ).send({ command: unsafeValue });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(JSON.stringify(response.body)).not.toContain(unsafeValue);
    expect(service.start).not.toHaveBeenCalled();
  });

  it('maps a held shared lock to a stable conflict', async () => {
    const service = createService({
      start: vi.fn().mockRejectedValue(new SyncAlreadyRunningError()),
    });
    const response = await authorized(
      request(createTestApp(service)).post('/api/internal/sync/runs'),
    );

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SYNC_ALREADY_RUNNING');
  });

  it('validates run IDs before reading persisted status', async () => {
    const service = createService();
    const response = await authorized(
      request(createTestApp(service)).get(
        '/api/internal/sync/runs/not-a-uuid',
      ),
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_RUN_ID');
    expect(service.get).not.toHaveBeenCalled();
  });

  it('returns a safe not-found response for an unknown run', async () => {
    const service = createService({
      get: vi.fn().mockRejectedValue(new SyncRunNotFoundError()),
    });
    const response = await authorized(
      request(createTestApp(service)).get(
        `/api/internal/sync/runs/${runId}`,
      ),
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('SYNC_RUN_NOT_FOUND');
  });

  it('returns safe status fields without leaking service errors', async () => {
    const completed: ManualSyncRun = {
      ...running,
      status: 'success',
      completedAt: '2026-08-27T12:01:00.000Z',
      movieCount: 20,
      tvShowCount: 4,
    };
    const service = createService({
      get: vi.fn().mockResolvedValue(completed),
    });
    const response = await authorized(
      request(createTestApp(service)).get(
        `/api/internal/sync/runs/${runId}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ...completed,
      state: 'success',
      status: undefined,
    });
  });

  it('redacts unexpected start errors', async () => {
    const secretDetail = 'token=private-value /volume1/private/path';
    const service = createService({
      start: vi.fn().mockRejectedValue(new Error(secretDetail)),
    });
    const response = await authorized(
      request(createTestApp(service)).post('/api/internal/sync/runs'),
    );

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('SYNC_TRIGGER_FAILED');
    expect(JSON.stringify(response.body)).not.toContain(secretDetail);
  });
});
