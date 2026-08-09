import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../middleware/apiError.js';
import type { TvShowService } from '../services/tvShowService.js';
import { paginationQuerySchema } from '../types/pagination.js';
import { tvShowIdSchema } from '../types/tvShowId.js';

export function createTvShowController(service: TvShowService) {
  return async function listTvShowsController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const parsedQuery = paginationQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      next(new ApiError(400, 'INVALID_QUERY', 'Invalid pagination parameters.'));
      return;
    }

    try {
      response.status(200).json(await service.listTvShows(parsedQuery.data));
    } catch (error) {
      next(error);
    }
  };
}

export function createTvShowDetailController(service: TvShowService) {
  return async function getTvShowController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const parsedId = tvShowIdSchema.safeParse(request.params.id);
    if (!parsedId.success) {
      next(new ApiError(400, 'INVALID_ID', 'Invalid TV show ID.'));
      return;
    }

    try {
      response.status(200).json(await service.getTvShow(parsedId.data));
    } catch (error) {
      next(error);
    }
  };
}
