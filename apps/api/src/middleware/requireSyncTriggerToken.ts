import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

import { ApiError } from './apiError.js';

const bearerPrefix = 'Bearer ';

function tokensMatch(
  receivedToken: string,
  expectedToken: string,
): boolean {
  const received = Buffer.from(receivedToken, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function requireSyncTriggerToken(
  expectedToken: string,
): RequestHandler {
  return (request, _response, next): void => {
    const authorization = request.header('authorization') ?? '';

    if (!authorization.startsWith(bearerPrefix)) {
      next(
        new ApiError(
          401,
          'SYNC_TRIGGER_UNAUTHORIZED',
          'Valid synchronization credentials are required.',
        ),
      );
      return;
    }

    const receivedToken = authorization.slice(bearerPrefix.length);

    if (!tokensMatch(receivedToken, expectedToken)) {
      next(
        new ApiError(
          401,
          'SYNC_TRIGGER_UNAUTHORIZED',
          'Valid synchronization credentials are required.',
        ),
      );
      return;
    }

    next();
  };
}