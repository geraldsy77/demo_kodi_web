import type { Pool } from 'mysql2/promise';

import { ApiError } from '../middleware/apiError.js';
import { getMovieById, getMoviePage } from '../repositories/movieRepository.js';
import type { MovieDetail, MovieListResponse } from '../types/movie.js';
import type { PaginationQuery } from '../types/pagination.js';
import { encodePublicId } from '../types/publicId.js';

export interface MovieService {
  listMovies(pagination: PaginationQuery): Promise<MovieListResponse>;
  getMovie(movieId: number): Promise<MovieDetail>;
}

export function createMovieService(pool: Pool): MovieService {
  return {
    async listMovies({ page, pageSize }) {
      const result = await getMoviePage(pool, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      return {
        items: result.items.map((movie) => ({
          ...movie,
          id: encodePublicId('movie', movie.id),
        })),
        pagination: {
          page,
          pageSize,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / pageSize),
        },
      };
    },
    async getMovie(movieId) {
      const movie = await getMovieById(pool, movieId);
      if (!movie) {
        throw new ApiError(404, 'MOVIE_NOT_FOUND', 'Movie not found.');
      }

      return { ...movie, id: encodePublicId('movie', movie.id) };
    },
  };
}
