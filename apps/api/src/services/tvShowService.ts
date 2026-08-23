import type { Pool } from 'mysql2/promise';

import { ApiError } from '../middleware/apiError.js';
import {
  getTvShowById,
  getTvShowPage,
} from '../repositories/tvShowRepository.js';
import type { PaginationQuery } from '../types/pagination.js';
import type { TvShowDetail, TvShowListResponse } from '../types/tvShow.js';
import { encodePublicId } from '../types/publicId.js';

export interface TvShowService {
  listTvShows(pagination: PaginationQuery): Promise<TvShowListResponse>;
  getTvShow(tvShowId: number): Promise<TvShowDetail>;
}

export function createTvShowService(pool: Pool): TvShowService {
  return {
    async listTvShows({ page, pageSize }) {
      const result = await getTvShowPage(pool, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: result.items.map((tvShow) => ({
          ...tvShow,
          id: encodePublicId('tvshow', tvShow.id),
        })),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / pageSize),
        },
      };
    },
    async getTvShow(tvShowId) {
      const tvShow = await getTvShowById(pool, tvShowId);
      if (!tvShow) {
        throw new ApiError(404, 'TV_SHOW_NOT_FOUND', 'TV show not found.');
      }

      return { ...tvShow, id: encodePublicId('tvshow', tvShow.id) };
    },
  };
}
