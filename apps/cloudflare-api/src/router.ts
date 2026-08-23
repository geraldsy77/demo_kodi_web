import { ApiError } from './http';
import { encodePublicId } from './publicId';
import {
  getMovie,
  getMovies,
  getSummary,
  getSyncStatus,
  getTvShow,
  getTvShows,
  search,
} from './repository';
import { parseId, parsePagination, parseSearch } from './validation';
import { synchronizeSnapshot } from './syncService';

function paginated<T>(items: T[], totalItems: number, page: number, pageSize: number) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}

export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/internal/sync/snapshots') {
    if (request.method !== 'POST') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    }
    return synchronizeSnapshot(request, env);
  }
  if (request.method !== 'GET') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
  }

  if (url.pathname === '/api/health') {
    return Response.json({ status: 'ok' });
  }
  if (url.pathname === '/api/library/summary') {
    return Response.json(await getSummary(env.DB));
  }
  if (url.pathname === '/api/sync/status') {
    const staleAfterSeconds = Number(env.SYNC_STALE_AFTER_SECONDS);
    if (!Number.isFinite(staleAfterSeconds) || staleAfterSeconds <= 0) {
      throw new Error('Invalid stale-data configuration.');
    }
    return Response.json(await getSyncStatus(env.DB, staleAfterSeconds));
  }
  if (url.pathname === '/api/movies') {
    const { page, pageSize } = parsePagination(url.searchParams);
    const result = await getMovies(env.DB, pageSize, (page - 1) * pageSize);
    return Response.json(paginated(
      result.items.map((movie) => ({
        ...movie,
        id: encodePublicId('movie', movie.id),
      })),
      result.totalItems,
      page,
      pageSize,
    ));
  }
  const movieMatch = /^\/api\/movies\/([^/]+)$/.exec(url.pathname);
  if (movieMatch?.[1]) {
    const movie = await getMovie(env.DB, parseId(movieMatch[1], 'movie'));
    if (!movie) throw new ApiError(404, 'MOVIE_NOT_FOUND', 'Movie not found.');
    return Response.json({ ...movie, id: encodePublicId('movie', movie.id) });
  }
  if (url.pathname === '/api/tvshows') {
    const { page, pageSize } = parsePagination(url.searchParams);
    const result = await getTvShows(env.DB, pageSize, (page - 1) * pageSize);
    return Response.json(paginated(
      result.items.map((show) => ({
        ...show,
        id: encodePublicId('tvshow', show.id),
      })),
      result.totalItems,
      page,
      pageSize,
    ));
  }
  const showMatch = /^\/api\/tvshows\/([^/]+)$/.exec(url.pathname);
  if (showMatch?.[1]) {
    const show = await getTvShow(env.DB, parseId(showMatch[1], 'tvshow'));
    if (!show) throw new ApiError(404, 'TV_SHOW_NOT_FOUND', 'TV show not found.');
    return Response.json({ ...show, id: encodePublicId('tvshow', show.id) });
  }
  if (url.pathname === '/api/search') {
    const { q, page, pageSize } = parseSearch(url.searchParams);
    const result = await search(env.DB, q, pageSize, (page - 1) * pageSize);
    return Response.json(paginated(
      result.items.map((item) => ({
        ...item,
        id: encodePublicId(item.entityType, item.id),
      })),
      result.totalItems,
      page,
      pageSize,
    ));
  }

  throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
}
