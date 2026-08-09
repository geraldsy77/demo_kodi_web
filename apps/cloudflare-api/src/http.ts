export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers?: HeadersInit,
  ) {
    super(message);
  }
}

export function errorResponse(error: ApiError): Response {
  return Response.json({
    error: { code: error.code, message: error.message },
  }, { status: error.status, headers: error.headers });
}

export const databaseError = new ApiError(
  500,
  'DATABASE_ERROR',
  'Unable to read the KODI library.',
);

export const syncDatabaseError = new ApiError(
  500,
  'SYNC_DATABASE_ERROR',
  'Unable to synchronize the library snapshot.',
);
