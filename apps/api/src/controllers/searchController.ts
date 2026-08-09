import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../middleware/apiError.js';
import type { SearchService } from '../services/searchService.js';
import { searchQuerySchema } from '../types/search.js';

export function createSearchController(service: SearchService) {
  return async function searchController(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    const parsedQuery = searchQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      next(new ApiError(400, 'INVALID_QUERY', 'Invalid search parameters.'));
      return;
    }

    try {
      response.status(200).json(await service.search(parsedQuery.data));
    } catch (error) {
      next(error);
    }
  };
}
