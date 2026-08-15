import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';

import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/healthRoutes.js';
import { createLibraryRouter } from './routes/libraryRoutes.js';
import { createMovieRouter } from './routes/movieRoutes.js';
import { createSearchRouter } from './routes/searchRoutes.js';
import { createTvShowRouter } from './routes/tvShowRoutes.js';
import { createLibrarySummaryService } from './services/librarySummaryService.js';
import { createMovieService } from './services/movieService.js';
import { createSearchService } from './services/searchService.js';
import { createTvShowService } from './services/tvShowService.js';
import { mountStaticWebApplication } from './web/staticWebApplication.js';

interface AppOptions {
  webDistPath?: string;
}

export function createApp(pool: Pool, options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use(
    '/api/library',
    createLibraryRouter(createLibrarySummaryService(pool)),
  );
  app.use('/api/movies', createMovieRouter(createMovieService(pool)));
  app.use('/api/tvshows', createTvShowRouter(createTvShowService(pool)));
  app.use('/api/search', createSearchRouter(createSearchService(pool)));
  if (options.webDistPath) {
    mountStaticWebApplication(app, options.webDistPath);
  }
  app.use(errorHandler);

  return app;
}
