import type { ErrorRequestHandler } from 'express';

import { ApiError } from './apiError.js';

export const errorHandler: ErrorRequestHandler = (
  _error,
  _request,
  response,
  _next,
) => {
  void _next;
  if (_error instanceof ApiError) {
    response.status(_error.status).json({
      error: {
        code: _error.code,
        message: _error.message,
      },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: 'DATABASE_ERROR',
      message: 'Unable to read the KODI library.',
    },
  });
};
