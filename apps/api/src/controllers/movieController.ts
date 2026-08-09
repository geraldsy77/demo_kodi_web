import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../middleware/apiError.js';
import type { MovieService } from '../services/movieService.js';
import { movieIdSchema } from '../types/movieId.js';
import { paginationQuerySchema } from '../types/pagination.js';

export function createMovieController(service: MovieService) {
  return async function listMoviesController(
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
      response.status(200).json(await service.listMovies(parsedQuery.data));
    } catch (error) {
      next(error);
    }
  };
}

export function createMovieDetailController(service: MovieService) {
  return async function getMovieController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const parsedId = movieIdSchema.safeParse(request.params.id);
    if (!parsedId.success) {
      next(new ApiError(400, 'INVALID_ID', 'Invalid movie ID.'));
      return;
    }

    try {
      response.status(200).json(await service.getMovie(parsedId.data));
    } catch (error) {
      next(error);
    }
  };
}
