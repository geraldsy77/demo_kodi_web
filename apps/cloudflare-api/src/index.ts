import { ApiError, databaseError, errorResponse, syncDatabaseError } from './http';
import { route } from './router';

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error(JSON.stringify({
        message: 'Worker API request failed',
        path: new URL(request.url).pathname,
      }));
      return errorResponse(
        new URL(request.url).pathname === '/api/internal/sync/snapshots'
          ? syncDatabaseError
          : databaseError,
      );
    }
  },
} satisfies ExportedHandler<Env>;
