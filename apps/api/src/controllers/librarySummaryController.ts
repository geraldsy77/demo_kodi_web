import type { NextFunction, Request, Response } from 'express';

import type { LibrarySummaryService } from '../services/librarySummaryService.js';

export function createLibrarySummaryController(
  service: LibrarySummaryService,
) {
  return async function getLibrarySummaryController(
    _request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      response.status(200).json(await service.getSummary());
    } catch (error) {
      next(error);
    }
  };
}
