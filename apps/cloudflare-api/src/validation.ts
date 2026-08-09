import { ApiError } from './http';

export interface PageQuery {
  page: number;
  pageSize: number;
}

function singleParameter(
  parameters: URLSearchParams,
  name: string,
): string | null | undefined {
  const values = parameters.getAll(name);
  if (values.length > 1) return undefined;
  return values[0] ?? null;
}

function positiveInteger(value: string | null, fallback?: number): number | null {
  if (value === null) return fallback ?? null;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parsePagination(parameters: URLSearchParams): PageQuery {
  const rawPage = singleParameter(parameters, 'page');
  const rawPageSize = singleParameter(parameters, 'pageSize');
  if (rawPage === undefined || rawPageSize === undefined) {
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid pagination parameters.');
  }
  const page = positiveInteger(rawPage, 1);
  const pageSize = positiveInteger(rawPageSize, 24);
  if (page === null || pageSize === null || pageSize > 100) {
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid pagination parameters.');
  }
  return { page, pageSize };
}

export function parseSearch(parameters: URLSearchParams): PageQuery & { q: string } {
  const rawQuery = singleParameter(parameters, 'q');
  if (rawQuery === undefined || rawQuery === null) {
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid search parameters.');
  }
  const q = rawQuery.trim();
  let pagination: PageQuery;
  try {
    pagination = parsePagination(parameters);
  } catch {
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid search parameters.');
  }
  if (q.length < 1 || q.length > 100) {
    throw new ApiError(400, 'INVALID_QUERY', 'Invalid search parameters.');
  }
  return { ...pagination, q };
}

export function parseId(value: string, entity: 'movie' | 'tvshow'): number {
  const id = positiveInteger(value);
  if (id === null) {
    throw new ApiError(
      400,
      'INVALID_ID',
      entity === 'movie' ? 'Invalid movie ID.' : 'Invalid TV show ID.',
    );
  }
  return id;
}
