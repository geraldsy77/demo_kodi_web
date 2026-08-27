import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { ApiError } from '../middleware/apiError.js';
import type {
  ManualSyncTriggerService,
} from '../services/manualSyncTriggerService.js';
import {
  SyncAlreadyRunningError,
  SyncRunNotFoundError,
} from '../services/manualSyncTriggerService.js';
import type { ManualSyncRun } from '../services/manualSyncRunStore.js';

const runIdSchema = z.string().uuid();

function toResponse(run: ManualSyncRun) {
  return {
    runId: run.runId,
    state: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    movieCount: run.movieCount,
    tvShowCount: run.tvShowCount,
    failureCode: run.failureCode,
  };
}

function hasInvalidBody(body: unknown): boolean {
  if (body === undefined) return false;

  return (
    body === null ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length > 0
  );
}

export function createStartManualSyncController(
  service: ManualSyncTriggerService,
) {
  return async function startManualSyncController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    if (hasInvalidBody(request.body)) {
      next(
        new ApiError(
          400,
          'INVALID_REQUEST',
          'The synchronization request must not contain properties.',
        ),
      );
      return;
    }

    try {
      const run = await service.start();

      response.status(202).json({
        runId: run.runId,
        state: run.status,
        startedAt: run.startedAt,
        statusUrl: `/api/internal/sync/runs/${run.runId}`,
      });
    } catch (error) {
      if (error instanceof SyncAlreadyRunningError) {
        next(
          new ApiError(
            409,
            'SYNC_ALREADY_RUNNING',
            'A synchronization run is already in progress.',
          ),
        );
        return;
      }

      next(
        new ApiError(
          500,
          'SYNC_TRIGGER_FAILED',
          'The synchronization run could not be started.',
        ),
      );
    }
  };
}

export function createGetManualSyncController(
  service: ManualSyncTriggerService,
) {
  return async function getManualSyncController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const parsedRunId = runIdSchema.safeParse(request.params.runId);

    if (!parsedRunId.success) {
      next(
        new ApiError(
          400,
          'INVALID_RUN_ID',
          'The synchronization run ID is invalid.',
        ),
      );
      return;
    }

    try {
      const run = await service.get(parsedRunId.data);

      response.status(200).json(toResponse(run));
    } catch (error) {
      if (error instanceof SyncRunNotFoundError) {
        next(
          new ApiError(
            404,
            'SYNC_RUN_NOT_FOUND',
            'The synchronization run was not found.',
          ),
        );
        return;
      }

      next(
        new ApiError(
          500,
          'SYNC_TRIGGER_FAILED',
          'The synchronization status could not be read.',
        ),
      );
    }
  };
}