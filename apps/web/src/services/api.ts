export interface LibrarySummary {
  movieCount: number;
  tvShowCount: number;
}

export interface MovieListItem {
  id: string;
  title: string;
  premiered: string | null;
  rating: number | null;
  playCount: number | null;
  artworkUrl: string | null;
}

export interface MovieListResponse {
  items: MovieListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface MovieDetail extends MovieListItem {
  plot: string | null;
  userRating: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
  resume: {
    positionSeconds: number;
    totalSeconds: number;
  } | null;
}

export interface TvShowListItem {
  id: string;
  title: string;
  premiered: string | null;
  rating: number | null;
  totalEpisodes: number | null;
  watchedEpisodes: number | null;
  totalSeasons: number | null;
  artworkUrl: string | null;
}

export interface TvShowListResponse {
  items: TvShowListItem[];
  pagination: MovieListResponse['pagination'];
}

export interface TvShowDetail extends TvShowListItem {
  plot: string | null;
  userRating: number | null;
  durationSeconds: number | null;
  votes: number | null;
  lastPlayed: string | null;
  dateAdded: string | null;
}

export interface SearchResultItem {
  id: string;
  title: string;
  entityType: 'movie' | 'tvshow';
}

export interface SearchResponse {
  items: SearchResultItem[];
  pagination: MovieListResponse['pagination'];
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function isLibrarySummary(value: unknown): value is LibrarySummary {
  if (typeof value !== 'object' || value === null) return false;

  const summary = value as Record<string, unknown>;
  return Number.isSafeInteger(summary.movieCount) &&
    Number(summary.movieCount) >= 0 &&
    Number.isSafeInteger(summary.tvShowCount) &&
    Number(summary.tvShowCount) >= 0;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number' && Number.isFinite(value);
}

function isMovieListResponse(value: unknown): value is MovieListResponse {
  if (typeof value !== 'object' || value === null) return false;

  const response = value as Record<string, unknown>;
  const pagination = response.pagination as Record<string, unknown> | undefined;
  return Array.isArray(response.items) &&
    response.items.every((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;
      const movie = item as Record<string, unknown>;
      return typeof movie.id === 'string' && movie.id.length > 0 &&
        typeof movie.title === 'string' &&
        (movie.premiered === null || typeof movie.premiered === 'string') &&
        isNullableNumber(movie.rating) && isNullableNumber(movie.playCount) &&
        isNullableString(movie.artworkUrl);
    }) &&
    pagination !== undefined &&
    Number.isSafeInteger(pagination.page) && Number(pagination.page) > 0 &&
    Number.isSafeInteger(pagination.pageSize) && Number(pagination.pageSize) > 0 &&
    Number.isSafeInteger(pagination.totalItems) && Number(pagination.totalItems) >= 0 &&
    Number.isSafeInteger(pagination.totalPages) && Number(pagination.totalPages) >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isMovieDetail(value: unknown): value is MovieDetail {
  if (typeof value !== 'object' || value === null) return false;

  const movie = value as Record<string, unknown>;
  const resume = movie.resume as Record<string, unknown> | null;
  return typeof movie.id === 'string' && movie.id.length > 0 &&
    typeof movie.title === 'string' &&
    isNullableString(movie.plot) &&
    isNullableString(movie.premiered) &&
    isNullableNumber(movie.userRating) &&
    isNullableNumber(movie.rating) &&
    isNullableNumber(movie.votes) &&
    isNullableNumber(movie.playCount) &&
    isNullableString(movie.lastPlayed) &&
    isNullableString(movie.dateAdded) &&
    (resume === null || typeof resume === 'object' &&
      typeof resume.positionSeconds === 'number' &&
      Number.isFinite(resume.positionSeconds) && resume.positionSeconds >= 0 &&
      typeof resume.totalSeconds === 'number' &&
      Number.isFinite(resume.totalSeconds) && resume.totalSeconds >= 0);
}

function isTvShowItem(value: unknown): value is TvShowListItem {
  if (typeof value !== 'object' || value === null) return false;
  const show = value as Record<string, unknown>;
  return typeof show.id === 'string' && show.id.length > 0 &&
    typeof show.title === 'string' && isNullableString(show.premiered) &&
    isNullableNumber(show.rating) && isNullableNumber(show.totalEpisodes) &&
    isNullableNumber(show.watchedEpisodes) && isNullableNumber(show.totalSeasons) &&
    isNullableString(show.artworkUrl);
}

function hasValidPagination(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const pagination = value as Record<string, unknown>;
  return Number.isSafeInteger(pagination.page) && Number(pagination.page) > 0 &&
    Number.isSafeInteger(pagination.pageSize) && Number(pagination.pageSize) > 0 &&
    Number.isSafeInteger(pagination.totalItems) && Number(pagination.totalItems) >= 0 &&
    Number.isSafeInteger(pagination.totalPages) && Number(pagination.totalPages) >= 0;
}

function isTvShowListResponse(value: unknown): value is TvShowListResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  return Array.isArray(response.items) && response.items.every(isTvShowItem) &&
    hasValidPagination(response.pagination);
}

function isTvShowDetail(value: unknown): value is TvShowDetail {
  if (!isTvShowItem(value)) return false;
  const show = value as unknown as Record<string, unknown>;
  return isNullableString(show.plot) && isNullableNumber(show.userRating) &&
    isNullableNumber(show.durationSeconds) && isNullableNumber(show.votes) &&
    isNullableString(show.lastPlayed) && isNullableString(show.dateAdded);
}

function isSearchResponse(value: unknown): value is SearchResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Record<string, unknown>;
  return Array.isArray(response.items) && response.items.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false;
    const result = item as Record<string, unknown>;
    return typeof result.id === 'string' && result.id.length > 0 &&
      typeof result.title === 'string' &&
      (result.entityType === 'movie' || result.entityType === 'tvshow');
  }) && hasValidPagination(response.pagination);
}

export async function fetchLibrarySummary(
  signal?: AbortSignal,
): Promise<LibrarySummary> {
  const response = await fetch('/api/library/summary', {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json() as unknown;

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The library summary could not be loaded.',
    );
  }

  if (!isLibrarySummary(body)) {
    throw new ApiRequestError('The library returned an invalid response.');
  }

  return body;
}

export async function fetchMovies(
  page: number,
  signal?: AbortSignal,
): Promise<MovieListResponse> {
  const parameters = new URLSearchParams({ page: String(page), pageSize: '24' });
  const response = await fetch(`/api/movies?${parameters}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json() as unknown;

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The movie library could not be loaded.',
    );
  }

  if (!isMovieListResponse(body)) {
    throw new ApiRequestError('The movie library returned an invalid response.');
  }

  return body;
}

export async function fetchMovie(
  movieId: string,
  signal?: AbortSignal,
): Promise<MovieDetail> {
  const response = await fetch(`/api/movies/${encodeURIComponent(movieId)}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json() as unknown;

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The movie could not be loaded.',
      response.status,
    );
  }

  if (!isMovieDetail(body)) {
    throw new ApiRequestError('The movie returned an invalid response.');
  }

  return body;
}

export async function fetchTvShows(
  page: number,
  signal?: AbortSignal,
): Promise<TvShowListResponse> {
  const parameters = new URLSearchParams({ page: String(page), pageSize: '24' });
  const response = await fetch(`/api/tvshows?${parameters}`, {
    headers: { Accept: 'application/json' }, signal,
  });
  const body = await response.json() as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The TV-show library could not be loaded.',
      response.status,
    );
  }
  if (!isTvShowListResponse(body)) {
    throw new ApiRequestError('The TV-show library returned an invalid response.');
  }
  return body;
}

export async function fetchTvShow(
  showId: string,
  signal?: AbortSignal,
): Promise<TvShowDetail> {
  const response = await fetch(`/api/tvshows/${encodeURIComponent(showId)}`, {
    headers: { Accept: 'application/json' }, signal,
  });
  const body = await response.json() as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The TV show could not be loaded.',
      response.status,
    );
  }
  if (!isTvShowDetail(body)) {
    throw new ApiRequestError('The TV show returned an invalid response.');
  }
  return body;
}

export async function searchLibrary(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const parameters = new URLSearchParams({
    q: query,
    page: String(page),
    pageSize: '24',
  });
  const response = await fetch(`/api/search?${parameters}`, {
    headers: { Accept: 'application/json' }, signal,
  });
  const body = await response.json() as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiRequestError(
      errorBody.error?.message ?? 'The library search could not be loaded.',
      response.status,
    );
  }
  if (!isSearchResponse(body)) {
    throw new ApiRequestError('The library search returned an invalid response.');
  }
  return body;
}

export interface SyncStatus {
  status: 'current' | 'stale' | 'never_synced';
  stale: boolean;
  lastSuccessAt: string | null;
  durationSeconds: number | null;
  movieCount: number;
  tvShowCount: number;
}

function isSyncStatus(value: unknown): value is SyncStatus {
  if (typeof value !== 'object' || value === null) return false;
  const status = value as Record<string, unknown>;
  return (
    ['current', 'stale', 'never_synced'].includes(String(status.status)) &&
    typeof status.stale === 'boolean' &&
    isNullableString(status.lastSuccessAt) &&
    isNullableNumber(status.durationSeconds) &&
    Number.isSafeInteger(status.movieCount) && Number(status.movieCount) >= 0 &&
    Number.isSafeInteger(status.tvShowCount) && Number(status.tvShowCount) >= 0
  );
}

export async function fetchSyncStatus(
  signal?: AbortSignal,
): Promise<SyncStatus> {
  const response = await fetch('/api/sync/status', {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = await response.json() as unknown;

  if (!response.ok) {
    throw new ApiRequestError('Synchronization status could not be loaded.');
  }
  if (!isSyncStatus(body)) {
    throw new ApiRequestError(
      'Synchronization status returned an invalid response.',
    );
  }
  return body;
}
